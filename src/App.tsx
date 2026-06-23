import React, { useState, useEffect } from 'react';
import { 
  QueryClient, 
  QueryClientProvider, 
  useQuery, 
  useMutation, 
  useQueryClient 
} from '@tanstack/react-query';
import { 
  PlusCircle, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Moon, 
  Sun, 
  LogOut, 
  RefreshCw, 
  Check, 
  Plus, 
  Wallet,
  Building,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import api from './lib/api';

// Inicializar cliente de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Medios de Pago estándar
const MEDIOS_PAGO = ["Efectivo", "Bancolombia", "Nequi", "Daviplata", "Nu bank"];

// Función formateadora de moneda (COP)
const formatCOP = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

// Componente Principal con Proveedor de Query
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApp />
    </QueryClientProvider>
  );
}

function MainApp() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [darkMode, setDarkMode] = useState<boolean>(true); // Oscuro por defecto

  // Aplicar modo oscuro al HTML
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  if (!token) {
    return <LoginScreen onLoginSuccess={(newToken) => {
      localStorage.setItem('token', newToken);
      setToken(newToken);
    }} darkMode={darkMode} setDarkMode={setDarkMode} />;
  }

  return (
    <DashboardLayout onLogout={() => {
      localStorage.removeItem('token');
      setToken(null);
    }} darkMode={darkMode} setDarkMode={setDarkMode} />
  );
}

// --- PANTALLA DE LOGIN ---
function LoginScreen({ onLoginSuccess, darkMode, setDarkMode }: { 
  onLoginSuccess: (token: string) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}) {
  const [username, setUsername] = useState('agaray');
  const [password, setPassword] = useState('r0b1ns0n!');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await api.post('/api/auth/login', { username, password });
      onLoginSuccess(response.data.access_token);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 transition-colors duration-300">
      <button 
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-4 right-4 p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:opacity-80 transition"
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 transition-colors duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 mb-3">
            <Wallet size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Gastos Personales</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Ingresa a tu planificador financiero</p>
        </div>

        {errorMsg && (
          <div className="p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Usuario</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-950 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-950 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition duration-200 flex justify-center items-center"
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- LAYOUT DERECHO & DASHBOARD ---
function DashboardLayout({ onLogout, darkMode, setDarkMode }: {
  onLogout: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Vistas: 'dashboard' o 'charts'
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'charts'>('dashboard');

  // Modales
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  
  // Modal Pago Gasto Fijo
  const [selectedFixedLine, setSelectedFixedLine] = useState<any | null>(null);

  // Queries
  const { data: dashboardData, isLoading: loadingDash } = useQuery({
    queryKey: ['dashboard', selectedMonth, selectedYear],
    queryFn: async () => {
      const response = await api.get(`/api/dashboard/${selectedMonth}/${selectedYear}`);
      return response.data;
    }
  });

  const { data: transacciones, isLoading: loadingTrans } = useQuery({
    queryKey: ['transacciones', selectedMonth, selectedYear],
    queryFn: async () => {
      const response = await api.get(`/api/transacciones/${selectedMonth}/${selectedYear}`);
      return response.data;
    }
  });

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const response = await api.get('/api/categorias');
      return response.data;
    }
  });

  // Mutación para Registrar Gasto
  const expenseMutation = useMutation({
    mutationFn: async (payload: {
      categoria_id: number;
      monto_real: number;
      fecha: string;
      descripcion: string;
      establecimiento?: string;
      medio_pago: string;
    }) => {
      return api.post('/api/gastos', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transacciones'] });
      queryClient.invalidateQueries({ queryKey: ['historico'] });
      setShowExpenseModal(false);
    }
  });

  // Mutación para Registrar Ingreso Real
  const incomeMutation = useMutation({
    mutationFn: async (payload: {
      monto_real: number;
      fecha: string;
      descripcion: string;
      medio_pago: string;
    }) => {
      return api.post('/api/ingresos', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transacciones'] });
      queryClient.invalidateQueries({ queryKey: ['historico'] });
      setShowIncomeModal(false);
    }
  });

  // Mutación para Agregar/Editar Línea de Presupuesto
  const budgetMutation = useMutation({
    mutationFn: async (payload: {
      categoria_id: number;
      monto_presupuestado: number;
    }) => {
      return api.post(`/api/presupuestos/${selectedMonth}/${selectedYear}/lineas`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['historico'] });
      setShowBudgetModal(false);
    }
  });

  // Mutación para Configurar Ingreso Estimado
  const estimatedIncomeMutation = useMutation({
    mutationFn: async (ingreso: number) => {
      return api.post('/api/presupuestos', {
        mes: selectedMonth,
        anio: selectedYear,
        ingreso_estimado: ingreso
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });

  // Mutación para Clonar Presupuesto del Mes Anterior
  const cloneMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/api/presupuestos/${selectedMonth}/${selectedYear}/clonar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transacciones'] });
      alert("¡Presupuesto clonado con éxito!");
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || "No se pudo clonar el presupuesto.");
    }
  });

  // Mutación para Pagar Gasto Fijo
  const payFixedMutation = useMutation({
    mutationFn: async (payload: { lineaId: number; medio_pago: string }) => {
      return api.post(`/api/gastos/fijo/${payload.lineaId}/pagar?medio_pago=${payload.medio_pago}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['transacciones'] });
      queryClient.invalidateQueries({ queryKey: ['historico'] });
      setSelectedFixedLine(null);
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* HEADER */}
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-600 rounded-lg text-white">
            <Wallet size={24} />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">Finanzas Personales (COP)</span>
        </div>

        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:opacity-80"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={onLogout}
            className="p-2 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 flex items-center space-x-2"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline text-sm font-medium">Salir</span>
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* FILTROS Y CONTROLES */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <Calendar className="text-slate-400 ml-2" size={18} />
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-transparent border-none py-1.5 px-2 outline-none text-sm font-medium"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][i]}
                  </option>
                ))}
              </select>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-transparent border-none py-1.5 px-2 outline-none text-sm font-medium"
              >
                {[2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            
            {/* Importar Presupuesto */}
            <button 
              onClick={() => {
                if(confirm("¿Quieres clonar el presupuesto del mes anterior? Se duplicarán los límites establecidos.")) {
                  cloneMutation.mutate();
                }
              }}
              className="py-2 px-3 border border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition"
            >
              <RefreshCw size={14} />
              <span>Importar anterior</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-full sm:w-auto justify-center">
            <button 
              onClick={() => setCurrentTab('dashboard')}
              className={`flex-1 sm:flex-initial py-1.5 px-4 rounded-md text-xs font-semibold transition ${currentTab === 'dashboard' ? 'bg-white dark:bg-slate-900 text-purple-600 shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setCurrentTab('charts')}
              className={`flex-1 sm:flex-initial py-1.5 px-4 rounded-md text-xs font-semibold transition ${currentTab === 'charts' ? 'bg-white dark:bg-slate-900 text-purple-600 shadow' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}
            >
              Historial Anual
            </button>
          </div>
        </div>

        {currentTab === 'dashboard' ? (
          <>
            {/* RESUMEN DE TARJETAS (CARDS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Ingreso Estimado */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium">Ingreso Presupuestado</span>
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
                    <DollarSign size={16} />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatCOP(dashboardData?.ingreso_estimado || 0)}
                  </span>
                  <button 
                    onClick={() => {
                      const value = prompt("Ingresa el monto de ingresos estimados:", dashboardData?.ingreso_estimado || "0");
                      if (value !== null) {
                        const parsed = parseFloat(value);
                        if (!isNaN(parsed) && parsed >= 0) {
                          estimatedIncomeMutation.mutate(parsed);
                        }
                      }
                    }}
                    className="text-[10px] text-purple-600 hover:underline font-semibold"
                  >
                    Editar
                  </button>
                </div>
              </div>

              {/* Ingreso Real */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium">Ingresos Reales</span>
                  <div className="p-1.5 bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-lg">
                    <ArrowUpRight size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatCOP(dashboardData?.total_ingresos_reales || 0)}
                  </span>
                </div>
              </div>

              {/* Límite Presupuestado */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium">Límite Gastos</span>
                  <div className="p-1.5 bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400 rounded-lg">
                    <TrendingUp size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatCOP(dashboardData?.total_presupuestado || 0)}
                  </span>
                </div>
              </div>

              {/* Gasto Real */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium">Gastos Reales</span>
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-lg">
                    <ArrowDownRight size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatCOP(dashboardData?.total_real || 0)}
                  </span>
                </div>
              </div>

              {/* Balance de Caja */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium">Balance Neto</span>
                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${dashboardData?.balance_caja >= 0 ? 'bg-green-100 dark:bg-green-950/30 text-green-600' : 'bg-red-100 dark:bg-red-950/30 text-red-600'}`}>
                    {dashboardData?.balance_caja >= 0 ? 'Ahorro' : 'Déficit'}
                  </div>
                </div>
                <div className="mt-3">
                  <span className={`text-xl font-bold ${dashboardData?.balance_caja >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCOP(dashboardData?.balance_caja || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* ACCIONES RÁPIDAS */}
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => setShowExpenseModal(true)}
                className="py-2.5 px-5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl flex items-center space-x-2 shadow-lg shadow-purple-600/20 text-sm transition"
              >
                <PlusCircle size={18} />
                <span>Registrar Gasto</span>
              </button>

              <button 
                onClick={() => setShowIncomeModal(true)}
                className="py-2.5 px-5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl flex items-center space-x-2 shadow-lg shadow-green-600/20 text-sm transition"
              >
                <PlusCircle size={18} />
                <span>Registrar Ingreso Real</span>
              </button>

              <button 
                onClick={() => setShowBudgetModal(true)}
                className="py-2.5 px-5 border border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold rounded-xl flex items-center space-x-2 text-sm transition"
              >
                <Plus size={18} />
                <span>Planificar Límite</span>
              </button>
            </div>

            {/* LISTADO DE CATEGORÍAS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Planificación vs Gasto por Categoría</h2>
                <span className="text-xs text-slate-500">Formato en Pesos Colombianos (COP)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 px-6">Categoría</th>
                      <th className="py-3 px-6">Tipo</th>
                      <th className="py-3 px-6">Límite Presupuesto</th>
                      <th className="py-3 px-6">Gastado Real</th>
                      <th className="py-3 px-6">Diferencia</th>
                      <th className="py-3 px-6 text-right">Acción Gasto Fijo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {loadingDash ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">Cargando datos...</td>
                      </tr>
                    ) : dashboardData?.categorias.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">No hay límites de presupuesto configurados para este mes.</td>
                      </tr>
                    ) : (
                      dashboardData?.categorias.map((info: any) => (
                        <tr key={info.categoria_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                          <td className="py-4 px-6 font-semibold">{info.categoria_nombre}</td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${info.categoria_tipo === 'Fijo' ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400' : 'bg-teal-100 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400'}`}>
                              {info.categoria_tipo}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-medium">{formatCOP(info.monto_presupuestado)}</td>
                          <td className="py-4 px-6 font-medium">{formatCOP(info.monto_real)}</td>
                          <td className="py-4 px-6">
                            <span className={`font-bold ${info.estado === 'Rojo' ? 'text-red-500' : 'text-green-500'}`}>
                              {formatCOP(info.desviacion)}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            {info.categoria_tipo === 'Fijo' && (
                              <button 
                                onClick={() => setSelectedFixedLine(info)}
                                disabled={info.pagado_fijo || payFixedMutation.isPending}
                                className={`inline-flex items-center space-x-1.5 py-1 px-3 rounded-lg text-xs font-bold transition border ${info.pagado_fijo ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-purple-600 border-purple-600 text-white hover:bg-purple-750'}`}
                              >
                                {info.pagado_fijo ? (
                                  <>
                                    <Check size={12} />
                                    <span>Pagado</span>
                                  </>
                                ) : (
                                  <>
                                    <Building size={12} />
                                    <span>Marcar Pago</span>
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HISTORIAL DETALLADO DE TRANSACCIONES */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Historial de Transacciones del Mes</h2>
                <p className="text-xs text-slate-500">Muestra los ingresos y egresos ordenados cronológicamente</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 px-6">Fecha</th>
                      <th className="py-3 px-6">Tipo</th>
                      <th className="py-3 px-6">Categoría</th>
                      <th className="py-3 px-6">Descripción / Detalle</th>
                      <th className="py-3 px-6">Medio de Pago</th>
                      <th className="py-3 px-6">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {loadingTrans ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">Cargando transacciones...</td>
                      </tr>
                    ) : !transacciones || transacciones.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">No se registran movimientos para este mes.</td>
                      </tr>
                    ) : (
                      transacciones.map((t: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                          <td className="py-3.5 px-6 font-medium text-slate-500 dark:text-slate-400">{t.fecha}</td>
                          <td className="py-3.5 px-6">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${t.tipo === 'Ingreso' ? 'bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400'}`}>
                              {t.tipo}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 font-semibold">{t.categoria}</td>
                          <td className="py-3.5 px-6">
                            <div className="font-medium text-slate-900 dark:text-slate-100">{t.descripcion}</div>
                            {t.establecimiento && (
                              <div className="text-xs text-slate-400">Establecimiento: {t.establecimiento}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">
                            <div className="flex items-center space-x-1 text-xs">
                              <CreditCard size={14} className="text-slate-400" />
                              <span>{t.medio_pago}</span>
                            </div>
                          </td>
                          <td className={`py-3.5 px-6 font-bold ${t.tipo === 'Ingreso' ? 'text-green-500' : 'text-slate-950 dark:text-white'}`}>
                            {t.tipo === 'Ingreso' ? '+' : '-'}{formatCOP(t.monto)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* PANTALLA HISTÓRICOS Y GRÁFICOS */
          <div className="space-y-6">
            <YearlyHistoryView selectedYear={selectedYear} />
          </div>
        )}
      </main>

      {/* MODAL REGISTRAR GASTO */}
      {showExpenseModal && (
        <ExpenseModal 
          categorias={categorias || []}
          onClose={() => setShowExpenseModal(false)}
          onSubmit={(data) => expenseMutation.mutate(data)}
          isPending={expenseMutation.isPending}
        />
      )}

      {/* MODAL REGISTRAR INGRESO REAL */}
      {showIncomeModal && (
        <IncomeModal 
          onClose={() => setShowIncomeModal(false)}
          onSubmit={(data) => incomeMutation.mutate(data)}
          isPending={incomeMutation.isPending}
        />
      )}

      {/* MODAL PLANIFICAR PRESUPUESTO */}
      {showBudgetModal && (
        <BudgetModal 
          categorias={categorias || []}
          onClose={() => setShowBudgetModal(false)}
          onSubmit={(data) => budgetMutation.mutate(data)}
          isPending={budgetMutation.isPending}
        />
      )}

      {/* DIALOG DE CONFIRMACIÓN DE MEDIO DE PAGO PARA GASTO FIJO */}
      {selectedFixedLine && (
        <FixedPayDialog 
          line={selectedFixedLine}
          onClose={() => setSelectedFixedLine(null)}
          onConfirm={(medio) => payFixedMutation.mutate({ lineaId: selectedFixedLine.id, medio_pago: medio })}
          isPending={payFixedMutation.isPending}
        />
      )}
    </div>
  );
}

// --- VISTA GRÁFICO HISTORIAL ANUAL ---
function YearlyHistoryView({ selectedYear }: { selectedYear: number }) {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['historico', selectedYear],
    queryFn: async () => {
      const response = await api.get(`/api/historico/${selectedYear}`);
      return response.data;
    }
  });

  if (isLoading) {
    return <div className="py-12 text-center text-slate-500">Cargando gráfico evolutivo...</div>;
  }

  const totalCompareData = chartData?.map((item: any) => {
    let presupuestado = 0;
    let real = 0;
    item.detalles.forEach((det: any) => {
      presupuestado += parseFloat(det.presupuestado);
      real += parseFloat(det.real);
    });
    return {
      mes: item.mes,
      Presupuestado: presupuestado,
      Real: real
    };
  });

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Ejecución del Presupuesto Anual ({selectedYear})</h2>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={totalCompareData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e303a" />
              <XAxis dataKey="mes" stroke="#9ca3af" />
              <YAxis tickFormatter={(val) => formatCOP(val)} stroke="#9ca3af" />
              <Tooltip formatter={(value) => formatCOP(value as number)} />
              <Legend />
              <Bar dataKey="Presupuestado" fill="#8884d8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Real" fill="#c084fc" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Resumen Mensual Detallado</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-6">Mes</th>
                <th className="py-3 px-6">Total Presupuestado</th>
                <th className="py-3 px-6">Total Real</th>
                <th className="py-3 px-6">Desviación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {totalCompareData?.map((item: any, idx: number) => {
                const diff = item.Presupuestado - item.Real;
                return (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                    <td className="py-3 px-6 font-bold">{item.mes}</td>
                    <td className="py-3 px-6">{formatCOP(item.Presupuestado)}</td>
                    <td className="py-3 px-6">{formatCOP(item.Real)}</td>
                    <td className={`py-3 px-6 font-semibold ${diff < 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {formatCOP(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- MODAL DE GASTOS ---
function ExpenseModal({ categorias, onClose, onSubmit, isPending }: {
  categorias: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [catId, setCatId] = useState(categorias[0]?.id || '');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [descripcion, setDescripcion] = useState('');
  const [establecimiento, setEstablecimiento] = useState('');
  const [medioPago, setMedioPago] = useState(MEDIOS_PAGO[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(!catId || !monto || !fecha || !descripcion || !medioPago) return;
    onSubmit({
      categoria_id: parseInt(catId),
      monto_real: parseFloat(monto),
      fecha,
      descripcion,
      establecimiento: establecimiento || undefined,
      medio_pago: medioPago
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registrar Gasto Real</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Categoría</label>
            <select 
              value={catId} 
              onChange={(e) => setCatId(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
              required
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.tipo_gasto})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Monto en COP ($)</label>
              <input 
                type="number" 
                placeholder="Ej: 50000"
                value={monto} 
                onChange={(e) => setMonto(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white outline-none"
                required
                min="1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Medio de Pago</label>
              <select 
                value={medioPago} 
                onChange={(e) => setMedioPago(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                required
              >
                {MEDIOS_PAGO.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha</label>
            <input 
              type="date" 
              value={fecha} 
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Detalle / Descripción</label>
            <input 
              type="text" 
              placeholder="¿Qué compraste?"
              value={descripcion} 
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Establecimiento (Opcional)</label>
            <input 
              type="text" 
              placeholder="Ej: Éxito, Ara, Netflix"
              value={establecimiento} 
              onChange={(e) => setEstablecimiento(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button 
              type="button" 
              onClick={onClose}
              className="py-2 px-4 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-lg"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isPending}
              className="py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Registrar Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- MODAL DE INGRESO REAL ---
function IncomeModal({ onClose, onSubmit, isPending }: {
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [descripcion, setDescripcion] = useState('');
  const [medioPago, setMedioPago] = useState(MEDIOS_PAGO[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(!monto || !fecha || !descripcion || !medioPago) return;
    onSubmit({
      monto_real: parseFloat(monto),
      fecha,
      descripcion,
      medio_pago: medioPago
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registrar Ingreso Real</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Monto del Ingreso ($)</label>
              <input 
                type="number" 
                placeholder="Ej: 2500000"
                value={monto} 
                onChange={(e) => setMonto(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white outline-none"
                required
                min="1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Destino de Fondos</label>
              <select 
                value={medioPago} 
                onChange={(e) => setMedioPago(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
                required
              >
                {MEDIOS_PAGO.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Fecha</label>
            <input 
              type="date" 
              value={fecha} 
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Descripción / Fuente</label>
            <input 
              type="text" 
              placeholder="Ej: Salario Quincenal, Freelance..."
              value={descripcion} 
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white outline-none"
              required
            />
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button 
              type="button" 
              onClick={onClose}
              className="py-2 px-4 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-lg"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isPending}
              className="py-2 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Registrar Ingreso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- DIALOGO DE CONFIRMACION GASTO FIJO ---
function FixedPayDialog({ line, onClose, onConfirm, isPending }: {
  line: any;
  onClose: () => void;
  onConfirm: (medio: string) => void;
  isPending: boolean;
}) {
  const [medio, setMedio] = useState(MEDIOS_PAGO[0]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Marcar Gasto Fijo</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Vas a marcar como pagado **{line.categoria_nombre}** por un monto de **{formatCOP(line.monto_presupuestado)}**.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 mb-1">Medio de Pago</label>
          <select 
            value={medio} 
            onChange={(e) => setMedio(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
          >
            {MEDIOS_PAGO.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="py-2 px-4 border border-slate-205 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-sm"
          >
            Cancelar
          </button>
          <button 
            onClick={() => onConfirm(medio)}
            disabled={isPending}
            className="py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold text-sm disabled:opacity-50"
          >
            {isPending ? 'Procesando...' : 'Confirmar Pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MODAL PLANIFICAR PRESUPUESTO ---
function BudgetModal({ categorias, onClose, onSubmit, isPending }: {
  categorias: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [catId, setCatId] = useState(categorias[0]?.id || '');
  const [monto, setMonto] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(!catId || !monto) return;
    onSubmit({
      categoria_id: parseInt(catId),
      monto_presupuestado: parseFloat(monto)
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Planificar Línea Presupuestaria</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Categoría</label>
            <select 
              value={catId} 
              onChange={(e) => setCatId(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white"
              required
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre} ({c.tipo_gasto})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Monto Presupuestado COP ($)</label>
            <input 
              type="number" 
              placeholder="Ej: 300000"
              value={monto} 
              onChange={(e) => setMonto(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white outline-none"
              required
              min="1"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button 
              type="button" 
              onClick={onClose}
              className="py-2 px-4 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-lg"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isPending}
              className="py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {isPending ? 'Guardando...' : 'Guardar Límite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
