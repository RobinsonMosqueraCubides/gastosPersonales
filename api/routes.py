from datetime import date
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from .database import get_session
from .auth import verify_password, create_access_token, get_current_user
from .models import Usuario, Categoria, PresupuestoMensual, LineaPresupuesto, GastoReal, IngresoReal
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
    medio_pago: Optional[str] = "Efectivo"

class GastoRealResponse(BaseModel):
    id: int
    categoria_id: int
    monto_real: Decimal
    fecha: date
    descripcion: str
    establecimiento: Optional[str]
    medio_pago: Optional[str]

class IngresoRealCreate(BaseModel):
    monto_real: Decimal = Field(gt=0, decimal_places=2)
    fecha: date
    descripcion: str
    medio_pago: str

class IngresoRealResponse(BaseModel):
    id: int
    monto_real: Decimal
    fecha: date
    descripcion: str
    medio_pago: str
    presupuesto_mensual_id: int

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
    existe = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == data.mes)
        .where(PresupuestoMensual.anio == data.anio)
    ).first()
    
    if existe:
        # Si ya existe, actualizamos el ingreso estimado
        existe.ingreso_estimado = data.ingreso_estimado
        session.add(existe)
        session.commit()
        session.refresh(existe)
        return existe
        
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
    presupuesto = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == mes)
        .where(PresupuestoMensual.anio == anio)
    ).first()
    
    if not presupuesto:
        presupuesto = PresupuestoMensual(mes=mes, anio=anio, ingreso_estimado=Decimal("0.00"))
        session.add(presupuesto)
        session.commit()
        session.refresh(presupuesto)
        
    linea = session.exec(
        select(LineaPresupuesto)
        .where(LineaPresupuesto.presupuesto_mensual_id == presupuesto.id)
        .where(LineaPresupuesto.categoria_id == data.categoria_id)
    ).first()
    
    if linea:
        linea.monto_presupuestado = data.monto_presupuestado
    else:
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
        
    if mes == 1:
        mes_anterior = 12
        anio_anterior = anio - 1
    else:
        mes_anterior = mes - 1
        anio_anterior = anio
        
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
        
    if presupuesto_destino.ingreso_estimado == 0:
        presupuesto_destino.ingreso_estimado = presupuesto_anterior.ingreso_estimado
        session.add(presupuesto_destino)
        
    contador = 0
    for linea_ant in presupuesto_anterior.lineas:
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


# --- Rutas de Ingresos Reales ---
@router.post("/ingresos", response_model=IngresoRealResponse)
def create_ingreso(data: IngresoRealCreate, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    mes_ingreso = data.fecha.month
    anio_ingreso = data.fecha.year
    
    presupuesto = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == mes_ingreso)
        .where(PresupuestoMensual.anio == anio_ingreso)
    ).first()
    
    if not presupuesto:
        presupuesto = PresupuestoMensual(mes=mes_ingreso, anio=anio_ingreso, ingreso_estimado=Decimal("0.00"))
        session.add(presupuesto)
        session.commit()
        session.refresh(presupuesto)
        
    nuevo_ingreso = IngresoReal(
        presupuesto_mensual_id=presupuesto.id,
        monto_real=data.monto_real,
        fecha=data.fecha,
        descripcion=data.descripcion,
        medio_pago=data.medio_pago
    )
    session.add(nuevo_ingreso)
    session.commit()
    session.refresh(nuevo_ingreso)
    return nuevo_ingreso


# --- Rutas de Gastos Reales ---
@router.post("/gastos", response_model=GastoRealResponse)
def create_gasto(data: GastoRealCreate, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    mes_gasto = data.fecha.month
    anio_gasto = data.fecha.year
    
    presupuesto = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == mes_gasto)
        .where(PresupuestoMensual.anio == anio_gasto)
    ).first()
    
    if not presupuesto:
        presupuesto = PresupuestoMensual(mes=mes_gasto, anio=anio_gasto, ingreso_estimado=Decimal("0.00"))
        session.add(presupuesto)
        session.commit()
        session.refresh(presupuesto)
        
    linea = session.exec(
        select(LineaPresupuesto)
        .where(LineaPresupuesto.presupuesto_mensual_id == presupuesto.id)
        .where(LineaPresupuesto.categoria_id == data.categoria_id)
    ).first()
    
    if not linea:
        linea = LineaPresupuesto(
            presupuesto_mensual_id=presupuesto.id,
            categoria_id=data.categoria_id,
            monto_presupuestado=Decimal("0.00")
        )
        session.add(linea)
        session.commit()
        
    nuevo_gasto = GastoReal(
        categoria_id=data.categoria_id,
        monto_real=data.monto_real,
        fecha=data.fecha,
        descripcion=data.descripcion,
        establecimiento=data.establecimiento,
        medio_pago=data.medio_pago
    )
    session.add(nuevo_gasto)
    session.commit()
    session.refresh(nuevo_gasto)
    return nuevo_gasto

@router.post("/gastos/fijo/{linea_presupuesto_id}/pagar")
def pay_gasto_fijo(linea_presupuesto_id: int, medio_pago: str = "Efectivo", session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    linea = session.get(LineaPresupuesto, linea_presupuesto_id)
    if not linea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Línea de presupuesto no encontrada."
        )
        
    if linea.categoria.tipo_gasto != "Fijo":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La categoría asociada no es de tipo Gasto Fijo."
        )
        
    presupuesto = linea.presupuesto_mensual
    hoy = date.today()
    if hoy.month == presupuesto.mes and hoy.year == presupuesto.anio:
        fecha_gasto = hoy
    else:
        fecha_gasto = date(presupuesto.anio, presupuesto.mes, 1)
        
    nuevo_gasto = GastoReal(
        categoria_id=linea.categoria_id,
        monto_real=linea.monto_presupuestado,
        fecha=fecha_gasto,
        descripcion=f"Pago mensual de gasto fijo: {linea.categoria.nombre}",
        establecimiento="Pago Fijo",
        medio_pago=medio_pago
    )
    session.add(nuevo_gasto)
    session.commit()
    return {"message": "Gasto fijo marcado como pagado.", "gasto_id": nuevo_gasto.id}


# --- Rutas de Historial Unificado de Transacciones ---
@router.get("/transacciones/{mes}/{anio}")
def get_transacciones(mes: int, anio: int, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    primer_dia = date(anio, mes, 1)
    if mes == 12:
        ultimo_dia = date(anio + 1, 1, 1)
    else:
        ultimo_dia = date(anio, mes + 1, 1)
        
    # Consultar gastos reales
    gastos = session.exec(
        select(GastoReal)
        .where(GastoReal.fecha >= primer_dia)
        .where(GastoReal.fecha < ultimo_dia)
    ).all()
    
    # Consultar ingresos reales del presupuesto de este mes
    presupuesto = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == mes)
        .where(PresupuestoMensual.anio == anio)
    ).first()
    
    ingresos = []
    if presupuesto:
        ingresos = presupuesto.ingresos_reales
        
    resultado = []
    
    # Agregar Egresos (Gastos)
    for g in gastos:
        resultado.append({
            "id": g.id,
            "tipo": "Egreso",
            "monto": g.monto_real,
            "fecha": g.fecha,
            "descripcion": g.descripcion,
            "categoria": g.categoria.nombre if g.categoria else "Otros",
            "medio_pago": g.medio_pago or "Efectivo",
            "establecimiento": g.establecimiento or ""
        })
        
    # Agregar Ingresos
    for i in ingresos:
        resultado.append({
            "id": i.id,
            "tipo": "Ingreso",
            "monto": i.monto_real,
            "fecha": i.fecha,
            "descripcion": i.descripcion,
            "categoria": "Ingreso Real",
            "medio_pago": i.medio_pago or "Efectivo",
            "establecimiento": ""
        })
        
    # Ordenar por fecha descendente y luego por ID descendente
    resultado.sort(key=lambda x: (x["fecha"], x["id"]), reverse=True)
    return resultado


@router.get("/transacciones/anual/{anio}")
def get_transacciones_anuales(anio: int, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    # Consultar todos los gastos reales del año
    gastos = session.exec(
        select(GastoReal)
        .where(GastoReal.fecha >= date(anio, 1, 1))
        .where(GastoReal.fecha <= date(anio, 12, 31))
    ).all()
    
    # Consultar todos los presupuestos mensuales de ese año para obtener sus ingresos reales
    presupuestos = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.anio == anio)
    ).all()
    
    resultado = []
    
    # Agregar Egresos
    for g in gastos:
        resultado.append({
            "id": g.id,
            "tipo": "Egreso",
            "monto": g.monto_real,
            "fecha": g.fecha,
            "descripcion": g.descripcion,
            "categoria": g.categoria.nombre if g.categoria else "Otros",
            "medio_pago": g.medio_pago or "Efectivo",
            "establecimiento": g.establecimiento or ""
        })
        
    # Agregar Ingresos de todos los presupuestos del año
    for p in presupuestos:
        for i in p.ingresos_reales:
            resultado.append({
                "id": i.id,
                "tipo": "Ingreso",
                "monto": i.monto_real,
                "fecha": i.fecha,
                "descripcion": i.descripcion,
                "categoria": "Ingreso Real",
                "medio_pago": i.medio_pago or "Efectivo",
                "establecimiento": ""
            })
            
    # Ordenar por fecha descendente
    resultado.sort(key=lambda x: (x["fecha"], x["id"]), reverse=True)
    return resultado


# --- Dashboard ---
@router.get("/dashboard/{mes}/{anio}")
def get_dashboard(mes: int, anio: int, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    presupuesto = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.mes == mes)
        .where(PresupuestoMensual.anio == anio)
    ).first()
    
    if not presupuesto:
        return {
            "ingreso_estimado": 0,
            "total_ingresos_reales": 0,
            "total_presupuestado": 0,
            "total_real": 0,
            "desviacion": 0,
            "balance_caja": 0,
            "estado": "Verde",
            "categorias": []
        }
        
    primer_dia = date(anio, mes, 1)
    if mes == 12:
        ultimo_dia = date(anio + 1, 1, 1)
    else:
        ultimo_dia = date(anio, mes + 1, 1)
        
    gastos = session.exec(
        select(GastoReal)
        .where(GastoReal.fecha >= primer_dia)
        .where(GastoReal.fecha < ultimo_dia)
    ).all()
    
    # Calcular ingresos reales totales
    total_ingresos_reales = sum([i.monto_real for i in presupuesto.ingresos_reales])
    
    consolidado = {}
    
    for linea in presupuesto.lineas:
        consolidado[linea.categoria_id] = {
            "categoria_id": linea.categoria_id,
            "categoria_nombre": linea.categoria.nombre,
            "categoria_tipo": linea.categoria.tipo_gasto,
            "monto_presupuestado": linea.monto_presupuestado,
            "monto_real": Decimal("0.00"),
            "desviacion": linea.monto_presupuestado,
            "estado": "Verde",
            "pagado_fijo": False
        }
        
    for gasto in gastos:
        cat_id = gasto.categoria_id
        if cat_id not in consolidado:
            categoria = session.get(Categoria, cat_id)
            consolidado[cat_id] = {
                "categoria_id": cat_id,
                "categoria_nombre": categoria.nombre if categoria else "Otros",
                "categoria_tipo": categoria.tipo_gasto if categoria else "Variable",
                "monto_presupuestado": Decimal("0.00"),
                "monto_real": Decimal("0.00"),
                "desviacion": Decimal("0.00"),
                "estado": "Verde",
                "pagado_fijo": False
            }
        consolidado[cat_id]["monto_real"] += gasto.monto_real
        
    total_presupuestado = Decimal("0.00")
    total_real = Decimal("0.00")
    
    categorias_lista = []
    for cat_id, info in consolidado.items():
        m_pres = info["monto_presupuestado"]
        m_real = info["monto_real"]
        desviacion = m_pres - m_real
        
        info["desviacion"] = desviacion
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
    balance_caja = total_ingresos_reales - total_real
    
    return {
        "ingreso_estimado": presupuesto.ingreso_estimado,
        "total_ingresos_reales": total_ingresos_reales,
        "total_presupuestado": total_presupuestado,
        "total_real": total_real,
        "desviacion": desviacion_total,
        "balance_caja": balance_caja,
        "estado": estado_total,
        "categorias": categorias_lista
    }

# --- Análisis Histórico ---
@router.get("/historico/{anio}")
def get_historico(anio: int, session: Session = Depends(get_session), current_user: Usuario = Depends(get_current_user)):
    datos_historicos = []
    
    presupuestos_anio = session.exec(
        select(PresupuestoMensual)
        .where(PresupuestoMensual.anio == anio)
    ).all()
    
    resumen_mensual = {m: {} for m in range(1, 13)}
    
    for pres in presupuestos_anio:
        m = pres.mes
        for linea in pres.lineas:
            resumen_mensual[m][linea.categoria_id] = {
                "categoria_nombre": linea.categoria.nombre,
                "monto_presupuestado": linea.monto_presupuestado,
                "monto_real": Decimal("0.00")
            }
            
    primer_dia_anio = date(anio, 1, 1)
    ultimo_dia_anio = date(anio, 12, 31)
    
    gastos_anio = session.exec(
        select(GastoReal)
        .where(GastoReal.fecha >= primer_dia_anio)
        .where(GastoReal.fecha <= ultimo_dia_anio)
    ).all()
    
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
        
    meses_nombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    
    for m in range(1, 13):
        mes_data = {"mes": meses_nombres[m - 1], "numero_mes": m}
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
