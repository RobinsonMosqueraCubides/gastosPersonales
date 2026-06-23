from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select, func
from .database import get_session
from .auth import verify_password, create_access_token, get_current_user
from .models import Usuario, Categoria, PresupuestoMensual, LineaPresupuesto, GastoReal
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api")

# --- Esquemas de Pydantic ---
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class CategoriaSchema(BaseModel):
    id: int
    nombre: str
    tipo_gasto: str

class LineaPresupuestoCreate(BaseModel):
    categoria_id: int
    monto_presupuestado: Decimal = Field(gt=0, decimal_places=2)

class PresupuestoCreate(BaseModel):
    mes: int = Field(ge=1, le=12)
    anio: int = Field(ge=2000, le=2100)
    ingreso_estimado: Decimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)

class GastoRealCreate(BaseModel):
    categoria_id: int
    monto_real: Decimal = Field(gt=0, decimal_places=2)
    fecha: date
    descripcion: str
    establecimiento: Optional[str] = None

class GastoRealResponse(BaseModel):
    id: int
    categoria_id: int
    monto_real: Decimal
    fecha: date
    descripcion: str
    establecimiento: Optional[str]

# --- Rutas de Autenticación ---
@router.post("/auth/login", response_model=TokenResponse)
def login(login_data: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(Usuario).where(Usuario.username == login_data.username)).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos."
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# Endpoint secundario para compatibilidad con OAuth2PasswordBearer en Swagger UI
@router.post("/auth/login-swagger", response_model=TokenResponse)
def login_swagger(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(Usuario).where(Usuario.username == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos."
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/auth/me")
def get_me(current_user: Usuario = Depends(get_current_user)):
    return {"username": current_user.username, "id": current_user.id}


# --- Rutas de Categorías ---
@router.get("/categorias", response_model=List[CategoriaSchema])
def get_categorias(session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    return session.exec(select(Categoria)).all()


# --- Rutas de Presupuesto ---
@router.post("/presupuestos")
def create_presupuesto(data: PresupuestoCreate, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    # Verificar si ya existe un presupuesto para el mes y año seleccionados
    existe = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == data.mes)
        .where(PresupuestoMensual.anio == data.anio)
    ).first()
    
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un presupuesto para este mes y año."
        )
        
    nuevo_presupuesto = PresupuestoMensual(
        mes=data.mes,
        anio=data.anio,
        ingreso_estimado=data.ingreso_estimado
    )
    session.add(nuevo_presupuesto)
    session.commit()
    session.refresh(nuevo_presupuesto)
    return nuevo_presupuesto

@router.get("/presupuestos/{mes}/{anio}")
def get_presupuesto(mes: int, anio: int, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    presupuesto = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == mes)
        .where(PresupuestoMensual.anio == anio)
    ).first()
    
    if not presupuesto:
        return {"id": None, "mes": mes, "anio": anio, "ingreso_estimado": 0, "lineas": []}
        
    # Construir respuesta con líneas de presupuesto detalladas
    lineas_detalladas = []
    for linea in presupuesto.lineas:
        lineas_detalladas.append({
            "id": linea.id,
            "categoria_id": linea.categoria_id,
            "categoria_nombre": linea.categoria.nombre,
            "categoria_tipo": linea.categoria.tipo_gasto,
            "monto_presupuestado": linea.monto_presupuestado
        })
        
    return {
        "id": presupuesto.id,
        "mes": presupuesto.mes,
        "anio": presupuesto.anio,
        "ingreso_estimado": presupuesto.ingreso_estimado,
        "lineas": lineas_detalladas
    }

@router.post("/presupuestos/{mes}/{anio}/lineas")
def update_linea_presupuesto(mes: int, anio: int, data: LineaPresupuestoCreate, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    # Buscar presupuesto mensual
    presupuesto = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == mes)
        .where(PresupuestoMensual.anio == anio)
    ).first()
    
    if not presupuesto:
        # Inicializar automáticamente si no existe
        presupuesto = PresupuestoMensual(mes=mes, anio=anio, ingreso_estimado=Decimal("0.00"))
        session.add(presupuesto)
        session.commit()
        session.refresh(presupuesto)
        
    # Verificar si la línea ya existe para la categoría
    linea = session.exec(
        select(LineaPresupuesto)
        .where(LineaPresupuesto.presupuesto_mensual_id == presupuesto.id)
        .where(LineaPresupuesto.categoria_id == data.categoria_id)
    ).first()
    
    if linea:
        # Actualizar monto
        linea.monto_presupuestado = data.monto_presupuestado
    else:
        # Crear nueva línea
        linea = LineaPresupuesto(
            presupuesto_mensual_id=presupuesto.id,
            categoria_id=data.categoria_id,
            monto_presupuestado=data.monto_presupuestado
        )
    session.add(linea)
    session.commit()
    return {"message": "Línea de presupuesto guardada con éxito."}

@router.post("/presupuestos/{mes}/{anio}/clonar")
def clone_presupuesto(mes: int, anio: int, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    # 1. Buscar el presupuesto destino
    presupuesto_destino = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == mes)
        .where(PresupuestoMensual.anio == anio)
    ).first()
    
    if not presupuesto_destino:
        presupuesto_destino = PresupuestoMensual(mes=mes, anio=anio, ingreso_estimado=Decimal("0.00"))
        session.add(presupuesto_destino)
        session.commit()
        session.refresh(presupuesto_destino)
        
    # 2. Calcular mes/año del mes anterior
    if mes == 1:
        mes_anterior = 12
        anio_anterior = anio - 1
    else:
        mes_anterior = mes - 1
        anio_anterior = anio
        
    # 3. Buscar presupuesto anterior
    presupuesto_anterior = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == mes_anterior)
        .where(PresupuestoMensual.anio == anio_anterior)
    ).first()
    
    if not presupuesto_anterior or not presupuesto_anterior.lineas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró un presupuesto con líneas en el mes anterior para clonar."
        )
        
    # Duplicar el ingreso estimado si es 0
    if presupuesto_destino.ingreso_estimado == 0:
        presupuesto_destino.ingreso_estimado = presupuesto_anterior.ingreso_estimado
        session.add(presupuesto_destino)
        
    # 4. Clonar líneas
    contador = 0
    for linea_ant in presupuesto_anterior.lineas:
        # Verificar si ya existe una línea para esa categoría en el destino
        existe = session.exec(
            select(LineaPresupuesto)
            .where(LineaPresupuesto.presupuesto_mensual_id == presupuesto_destino.id)
            .where(LineaPresupuesto.categoria_id == linea_ant.categoria_id)
        ).first()
        
        if not existe:
            nueva_linea = LineaPresupuesto(
                presupuesto_mensual_id=presupuesto_destino.id,
                categoria_id=linea_ant.categoria_id,
                monto_presupuestado=linea_ant.monto_presupuestado
            )
            session.add(nueva_linea)
            contador += 1
            
    session.commit()
    return {"message": f"Clonación exitosa. Se copiaron {contador} líneas de presupuesto."}


# --- Rutas de Gastos Reales ---
@router.post("/gastos", response_model=GastoRealResponse)
def create_gasto(data: GastoRealCreate, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    # Obtener mes y año de la fecha del gasto
    mes_gasto = data.fecha.month
    anio_gasto = data.fecha.year
    
    # 1. Buscar o inicializar PresupuestoMensual para el período del gasto
    presupuesto = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == mes_gasto)
        .where(PresupuestoMensual.anio == anio_gasto)
    ).first()
    
    if not presupuesto:
        # Inicializar automáticamente
        presupuesto = PresupuestoMensual(mes=mes_gasto, anio=anio_gasto, ingreso_estimado=Decimal("0.00"))
        session.add(presupuesto)
        session.commit()
        session.refresh(presupuesto)
        
    # 2. CU6: Excepción - Gasto No Presupuestado
    # Verificar si la categoría está en el presupuesto de este mes
    linea = session.exec(
        select(LineaPresupuesto)
        .where(LineaPresupuesto.presupuesto_mensual_id == presupuesto.id)
        .where(LineaPresupuesto.categoria_id == data.categoria_id)
    ).first()
    
    if not linea:
        # Interceptar y crear línea de presupuesto con monto_presupuestado = 0
        linea = LineaPresupuesto(
            presupuesto_mensual_id=presupuesto.id,
            categoria_id=data.categoria_id,
            monto_presupuestado=Decimal("0.00")
        )
        session.add(linea)
        session.commit()
        
    # 3. Registrar el gasto
    nuevo_gasto = GastoReal(
        categoria_id=data.categoria_id,
        monto_real=data.monto_real,
        fecha=data.fecha,
        descripcion=data.descripcion,
        establecimiento=data.establecimiento
    )
    session.add(nuevo_gasto)
    session.commit()
    session.refresh(nuevo_gasto)
    return nuevo_gasto

@router.post("/gastos/fijo/{linea_presupuesto_id}/pagar")
def pay_gasto_fijo(linea_presupuesto_id: int, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    # 1. Obtener la línea de presupuesto
    linea = session.get(LineaPresupuesto, linea_presupuesto_id)
    if not linea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Línea de presupuesto no encontrada."
        )
        
    # Verificar que sea de tipo Fijo
    if linea.categoria.tipo_gasto != "Fijo":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La categoría asociada no es de tipo Gasto Fijo."
        )
        
    # 2. Generar el registro en Gastos_Reales
    # Obtenemos el mes/año del presupuesto para establecer la fecha
    presupuesto = linea.presupuesto_mensual
    # Si es el mes actual, usar el día de hoy, sino el primer día de ese mes/año presupuestado
    hoy = date.today()
    if hoy.month == presupuesto.mes and hoy.year == presupuesto.anio:
        fecha_gasto = hoy
    else:
        fecha_gasto = date(presupuesto.anio, presupuesto.mes, 1)
        
    nuevo_gasto = GastoReal(
        categoria_id=linea.categoria_id,
        monto_real=linea.monto_presupuestado,  # Paga exactamente el monto presupuestado
        fecha=fecha_gasto,
        descripcion=f"Pago mensual de gasto fijo: {linea.categoria.nombre}",
        establecimiento="Pago Fijo"
    )
    session.add(nuevo_gasto)
    session.commit()
    return {"message": "Gasto fijo marcado como pagado.", "gasto_id": nuevo_gasto.id}


# --- Rutas de Dashboard y Análisis (Moneda: COP) ---
@router.get("/dashboard/{mes}/{anio}")
def get_dashboard(mes: int, anio: int, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    # Obtener el presupuesto
    presupuesto = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == mes)
        .where(PresupuestoMensual.anio == anio)
    ).first()
    
    if not presupuesto:
        return {
            "ingreso_estimado": 0,
            "total_presupuestado": 0,
            "total_real": 0,
            "desviacion": 0,
            "estado": "Verde",
            "categorias": []
        }
        
    # Obtener todos los gastos de ese mes/año
    # Se filtran los gastos entre el primer y último día del mes
    primer_dia = date(anio, mes, 1)
    if mes == 12:
        ultimo_dia = date(anio + 1, 1, 1)
    else:
        ultimo_dia = date(anio, mes + 1, 1)
        
    # Consultar y agrupar gastos del mes
    gastos = session.exec(
        select(GastoReal)
        .where(GastoReal.fecha >= primer_dia)
        .where(GastoReal.fecha < ultimo_dia)
    ).all()
    
    # Mapeo de categorías del mes para consolidación
    consolidado = {}
    
    # Inicializar con lo presupuestado
    for linea in presupuesto.lineas:
        consolidado[linea.categoria_id] = {
            "categoria_id": linea.categoria_id,
            "categoria_nombre": linea.categoria.nombre,
            "categoria_tipo": linea.categoria.tipo_gasto,
            "monto_presupuestado": linea.monto_presupuestado,
            "monto_real": Decimal("0.00"),
            "desviacion": linea.monto_presupuestado,  # Al inicio, todo es saldo restante
            "estado": "Verde",
            "pagado_fijo": False
        }
        
    # Sumar los gastos reales
    for gasto in gastos:
        cat_id = gasto.categoria_id
        if cat_id not in consolidado:
            # Si hay un gasto pero no estaba presupuestado (debería crearse la línea, pero por seguridad controlamos)
            # Esto maneja consistencias
            categoria = session.get(Categoria, cat_id)
            consolidado[cat_id] = {
                "categoria_id": cat_id,
                "categoria_nombre": categoria.nombre if categoria else "Desconocida",
                "categoria_tipo": categoria.tipo_gasto if categoria else "Variable",
                "monto_presupuestado": Decimal("0.00"),
                "monto_real": Decimal("0.00"),
                "desviacion": Decimal("0.00"),
                "estado": "Verde",
                "pagado_fijo": False
            }
        consolidado[cat_id]["monto_real"] += gasto.monto_real
        
    # Calcular desviaciones de cada categoría
    total_presupuestado = Decimal("0.00")
    total_real = Decimal("0.00")
    
    categorias_lista = []
    for cat_id, info in consolidado.items():
        m_pres = info["monto_presupuestado"]
        m_real = info["monto_real"]
        desviacion = m_pres - m_real
        
        info["desviacion"] = desviacion
        # Si es fijo y ya tiene un gasto que cubre el presupuesto (o mayor a 0) se marca como pagado
        if info["categoria_tipo"] == "Fijo" and m_real >= m_pres and m_pres > 0:
            info["pagado_fijo"] = True
            
        if desviacion < 0:
            info["estado"] = "Rojo"
        else:
            info["estado"] = "Verde"
            
        total_presupuestado += m_pres
        total_real += m_real
        categorias_lista.append(info)
        
    desviacion_total = total_presupuestado - total_real
    estado_total = "Rojo" if desviacion_total < 0 else "Verde"
    
    return {
        "ingreso_estimado": presupuesto.ingreso_estimado,
        "total_presupuestado": total_presupuestado,
        "total_real": total_real,
        "desviacion": desviacion_total,
        "estado": estado_total,
        "categorias": categorias_lista
    }

@router.get("/historico/{anio}")
def get_historico(anio: int, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    # Retornar sumatorias de monto_presupuestado y monto_real para los 12 meses
    # Filtro por año
    datos_historicos = []
    
    # 1. Obtener todos los presupuestos de ese año
    presupuestos_anio = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.anio == anio)
    ).all()
    
    # Mapeo por mes {mes: {categoria_id: {presupuestado, real}}}
    resumen_mensual = {m: {} for m in range(1, 13)}
    
    # Inicializar con montos presupuestados
    for pres in presupuestos_anio:
        m = pres.mes
        for linea in pres.lineas:
            resumen_mensual[m][linea.categoria_id] = {
                "categoria_nombre": linea.categoria.nombre,
                "monto_presupuestado": linea.monto_presupuestado,
                "monto_real": Decimal("0.00")
            }
            
    # 2. Obtener todos los gastos de ese año
    primer_dia_anio = date(anio, 1, 1)
    ultimo_dia_anio = date(anio, 12, 31)
    
    gastos_anio = session.exec(
        select(GastoReal)
        .where(GastoReal.fecha >= primer_dia_anio)
        .where(GastoReal.fecha <= ultimo_dia_anio)
    ).all()
    
    # Sumar los gastos reales
    for gasto in gastos_anio:
        m = gasto.fecha.month
        cat_id = gasto.categoria_id
        
        if cat_id not in resumen_mensual[m]:
            categoria = session.get(Categoria, cat_id)
            resumen_mensual[m][cat_id] = {
                "categoria_nombre": categoria.nombre if categoria else "Otros",
                "monto_presupuestado": Decimal("0.00"),
                "monto_real": Decimal("0.00")
            }
        resumen_mensual[m][cat_id]["monto_real"] += gasto.monto_real
        
    # Formatear salida para el gráfico
    # [{ "mes": "Ene", "Supermercado": { presupuestado: X, real: Y }, ... }]
    meses_nombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    
    for m in range(1, 13):
        mes_data = {"mes": meses_nombres[m - 1], "numero_mes": m}
        # Agregar los detalles de cada categoría a este mes
        detalles = []
        for cat_id, info in resumen_mensual[m].items():
            detalles.append({
                "categoria_nombre": info["categoria_nombre"],
                "presupuestado": info["monto_presupuestado"],
                "real": info["monto_real"]
            })
        mes_data["detalles"] = detalles
        datos_historicos.append(mes_data)
        
    return datos_historicos
