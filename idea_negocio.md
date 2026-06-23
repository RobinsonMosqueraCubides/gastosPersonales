# Especificación de Requerimientos: Aplicativo Web de Control de Gastos Personales

## 1. Objetivo General
Desarrollar un aplicativo web responsivo (*Mobile-First*) para la gestión y control de finanzas personales. El sistema debe permitir la planeación de presupuestos mensuales, el registro detallado de gastos reales (tanto fijos como variables), la comparación en tiempo real de lo presupuestado frente a lo ejecutado y el almacenamiento de un histórico anual para el análisis de tendencias.

---

## 2. Stack Tecnológico Mandatorio
Para garantizar el despliegue óptimo en la capa gratuita de Vercel y el almacenamiento eficiente de datos estructurados, se utilizará:

* **Frontend:** React (inicializado con Vite).
* **Estilos y Componentes:** Tailwind CSS + Shadcn/ui (diseño limpio, responsivo y soporte nativo para Modo Oscuro).
* **Backend:** FastAPI (Python), estructurado para ejecutarse como Serverless Functions dentro de la carpeta `/api` compatible con Vercel.
* **Base de Datos:** Supabase (PostgreSQL), conectada mediante variables de entorno (Connection String) usando un pool de conexiones compatible con Serverless.

---

## 3. Modelo de Datos (Base de Datos Relacional)

El agente debe generar los scripts de migración o código de modelos (SQL / SQLAlchemy) basados en la siguiente estructura relacional:

### Tabla: `Categorias`
* `id`: UUID / Integer (Primary Key)
* `nombre`: VARCHAR (Ej. 'Supermercado', 'Arriendo', 'Restaurantes', 'Servicios Públicos')
* `tipo_gasto`: VARCHAR / ENUM ('Fijo', 'Variable')

### Tabla: `Presupuestos_Mensuales`
* `id`: UUID / Integer (Primary Key)
* `mes`: INTEGER (1 al 12)
* `anio`: INTEGER (Ej. 2026)
* `ingreso_estimado`: NUMERIC(12, 2)

### Tabla: `Lineas_Presupuesto`
* `id`: UUID / Integer (Primary Key)
* `presupuesto_mensual_id`: FK -> `Presupuestos_Mensuales(id)` (On Delete Cascade)
* `categoria_id`: FK -> `Categorias(id)`
* `monto_presupuestado`: NUMERIC(12, 2)

### Tabla: `Gastos_Reales`
* `id`: UUID / Integer (Primary Key)
* `categoria_id`: FK -> `Categorias(id)`
* `monto_real`: NUMERIC(12, 2)
* `fecha`: DATE (Fecha del gasto)
* `descripcion`: TEXT (Detalle de qué se compró, ej: "Mercado mensual, carnes y verduras")
* `establecimiento`: VARCHAR (Opcional, ej: "Éxito", "Netflix")

---

## 4. Casos de Uso a Implementar

El agente de desarrollo debe asegurar que la lógica de negocio y las interfaces resuelvan los siguientes flujos:

### CU1: Planificación - Crear Presupuesto del Mes
* **Flujo:** El usuario inicializa un mes/año, el backend crea el registro en `Presupuestos_Mensuales` y permite añadir filas en `Lineas_Presupuesto` vinculando montos a las `Categorias` existentes.

### CU2: Optimización - Clonar Presupuesto Anterior
* **Flujo:** Al crear un nuevo mes, el sistema expone un botón "Importar mes anterior". El backend busca las `Lineas_Presupuesto` del mes inmediatamente anterior, duplica sus montos y las asocia al nuevo ID de `Presupuestos_Mensuales`.

### CU3: Operación - Registrar Gasto Variable al Instante
* **Flujo:** Formulario ultra-rápido en frontend (enfoque móvil). Pide Monto, Selección de Categoría (filtrando por variables) y Descripción ("qué se compró"). Guarda el registro en `Gastos_Reales` con la fecha actual.

### CU4: Operación - Marcar Gasto Fijo como "Pagado"
* **Flujo:** Vista de control mensual que lista los gastos de tipo 'Fijo' presupuestados. Al hacer clic en "Marcar como pagado", el sistema genera el registro correspondiente en `Gastos_Reales` y cambia el estado visual a completado.

### CU5: Monitoreo - Dashboard de Desviación en Tiempo Real
* **Flujo:** Pantalla principal que consume un endpoint agrupado. Realiza el cálculo matemático:
    $$\text{Desviacion} = \text{Monto Presupuestado} - \text{Monto Real}$$
    * Si el gasto real supera al presupuestado, el componente de Shadcn/ui debe renderizar una alerta visual en color **Rojo**.
    * Si está dentro del límite, se muestra en **Verde** indicando el saldo restante.

### CU6: Excepción - Gasto No Presupuestado
* **Lógica:** Si el usuario registra un gasto real en una categoría que no fue incluida en las `Lineas_Presupuesto` de ese mes, el backend debe interceptar la petición, crear automáticamente la `Linea_Presupuesto` con `monto_presupuestado = 0` y procesar el gasto, reflejando el sobregiro de forma limpia.

### CU7: Análisis - Histórico Evolutivo por Categoría
* **Flujo:** Filtro por Categoría y Año. El backend agrupa las sumatorias de `monto_presupuestado` y `monto_real` de los 12 meses de ese año y el frontend los pinta en un gráfico de líneas o barras comparativas para identificar patrones de consumo.

---

## 5. Instrucciones para el Agente de Ejecución

1.  **Estructura del Proyecto:** Crea un monorepo o estructura limpia apta para Vercel (Frontend en la raíz o en carpeta compartida, Backend estrictamente bajo `/api` usando FastAPI).
2.  **Base de Datos:** Configura la conexión a PostgreSQL (Supabase) utilizando variables de entorno de manera segura (`.env`).
3.  **UI/UX:** Diseña una interfaz limpia, sin saturación visual, priorizando un Dashboard con componentes de tarjetas (`Cards`) y tablas scannables. Incluye soporte para cambiar entre tema claro y oscuro (preferiblemente oscuro por defecto).
4.  **Validaciones:** Asegura que los montos no acepten valores negativos y que las fechas de los históricos correspondan correctamente al periodo consultado.