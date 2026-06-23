from datetime import date
from decimal import Decimal
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

# --- Modelo de Usuario ---
class Usuario(SQLModel, table=True):
    __tablename__ = "usuarios"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str

# --- Modelo de Categorías ---
class Categoria(SQLModel, table=True):
    __tablename__ = "categorias"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(index=True)
    tipo_gasto: str = Field(description="Fijo o Variable")  # 'Fijo' o 'Variable'
    
    # Relaciones
    lineas_presupuesto: List["LineaPresupuesto"] = Relationship(back_populates="categoria")
    gastos_reales: List["GastoReal"] = Relationship(back_populates="categoria")

# --- Modelo de Presupuestos Mensuales ---
class PresupuestoMensual(SQLModel, table=True):
    __tablename__ = "presupuestos_mensuales"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    mes: int = Field(ge=1, le=12)
    anio: int
    ingreso_estimado: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)
    
    # Relaciones
    lineas: List["LineaPresupuesto"] = Relationship(
        back_populates="presupuesto_mensual", 
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

# --- Modelo de Líneas de Presupuesto ---
class LineaPresupuesto(SQLModel, table=True):
    __tablename__ = "lineas_presupuesto"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    presupuesto_mensual_id: int = Field(foreign_key="presupuestos_mensuales.id")
    categoria_id: int = Field(foreign_key="categorias.id")
    monto_presupuestado: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)
    
    # Relaciones
    presupuesto_mensual: PresupuestoMensual = Relationship(back_populates="lineas")
    categoria: Categoria = Relationship(back_populates="lineas_presupuesto")

# --- Modelo de Gastos Reales ---
class GastoReal(SQLModel, table=True):
    __tablename__ = "gastos_reales"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    categoria_id: int = Field(foreign_key="categorias.id")
    monto_real: Decimal = Field(max_digits=12, decimal_places=2)
    fecha: date = Field(default_factory=date.today)
    descripcion: str
    establecimiento: Optional[str] = Field(default=None)
    
    # Relaciones
    categoria: Categoria = Relationship(back_populates="gastos_reales")
