import os
from dotenv import load_dotenv
from sqlmodel import create_engine, SQLModel, Session, select
from passlib.context import CryptContext

# Cargar variables de entorno
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Si no está configurado, usar SQLite para desarrollo local por defecto
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./gastos.db"

# Si es postgresql, asegurarse de usar el driver puro pg8000 en sqlmodel/sqlalchemy para evitar dependencias C en Windows
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+pg8000://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+pg8000://", 1)

# Usar pool_pre_ping para evitar caídas de conexiones inactivas en Supabase
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True, 
    echo=False
)

# Contexto de contraseñas para hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_session():
    with Session(engine) as session:
        yield session

def init_db():
    # Crear las tablas
    SQLModel.metadata.create_all(engine)
    
    # Seeding inicial (Crear usuario inicial y categorías estándar)
    with Session(engine) as session:
        from .models import Usuario, Categoria
        
        # 1. Crear usuario default 'agaray' si no existe
        usuario_db = session.exec(select(Usuario).where(Usuario.username == "agaray")).first()
        if not usuario_db:
            hashed_pw = pwd_context.hash("r0b1ns0n!")
            nuevo_usuario = Usuario(username="agaray", hashed_password=hashed_pw)
            session.add(nuevo_usuario)
            
        # 2. Crear categorías estándar si la tabla está vacía
        categorias_db = session.exec(select(Categoria)).first()
        if not categorias_db:
            categorias_iniciales = [
                Categoria(nombre="Supermercado", tipo_gasto="Variable"),
                Categoria(nombre="Arriendo", tipo_gasto="Fijo"),
                Categoria(nombre="Restaurantes", tipo_gasto="Variable"),
                Categoria(nombre="Servicios Públicos", tipo_gasto="Fijo"),
                Categoria(nombre="Transporte", tipo_gasto="Variable"),
                Categoria(nombre="Entretenimiento", tipo_gasto="Variable"),
                Categoria(nombre="Salud", tipo_gasto="Fijo"),
                Categoria(nombre="Educación", tipo_gasto="Fijo"),
                Categoria(nombre="Otros", tipo_gasto="Variable")
            ]
            for cat in categorias_iniciales:
                session.add(cat)
                
        session.commit()
