import { Toaster } from "@/components/ui/toaster"
import GlobalRequiredFieldsGuard from '@/components/common/GlobalRequiredFieldsGuard';
import GlobalDeleteBlockDialog from '@/components/common/GlobalDeleteBlockDialog';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ManejosTecnicosRebanho from './pages/ManejosTecnicosRebanho';
import MovimentacoesLote from './pages/MovimentacoesLote';
import ContasFinanceiras from './pages/ContasFinanceiras';
import TiposDocumento from './pages/TiposDocumento';
import MotivosCompra from './pages/MotivosCompra';
import Marcas from './pages/Marcas';
import LancamentosAbastecimento from './pages/LancamentosAbastecimento';
import ConfiguracaoPesagens from './pages/ConfiguracaoPesagens';
import Bebedouros from './pages/Bebedouros';
import RelatorioGadoMapaGeral from './pages/RelatorioGadoMapaGeral';
import RelatorioEstoqueDepositos from './pages/RelatorioEstoqueDepositos';
import DiagnosticoDepositoCocho from './pages/DiagnosticoDepositoCocho';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/ManejosTecnicosRebanho" element={
        <LayoutWrapper currentPageName="ManejosTecnicosRebanho">
          <ManejosTecnicosRebanho />
        </LayoutWrapper>
      } />
      <Route path="/MovimentacoesLote" element={
        <LayoutWrapper currentPageName="MovimentacoesLote">
          <MovimentacoesLote />
        </LayoutWrapper>
      } />
      <Route path="/ContasFinanceiras" element={
        <LayoutWrapper currentPageName="ContasFinanceiras">
          <ContasFinanceiras />
        </LayoutWrapper>
      } />
      <Route path="/TiposDocumento" element={
        <LayoutWrapper currentPageName="TiposDocumento">
          <TiposDocumento />
        </LayoutWrapper>
      } />
      <Route path="/MotivosCompra" element={
        <LayoutWrapper currentPageName="MotivosCompra">
          <MotivosCompra />
        </LayoutWrapper>
      } />
      <Route path="/Marcas" element={
        <LayoutWrapper currentPageName="Marcas">
          <Marcas />
        </LayoutWrapper>
      } />
      <Route path="/LancamentosAbastecimento" element={
        <LayoutWrapper currentPageName="LancamentosAbastecimento">
          <LancamentosAbastecimento />
        </LayoutWrapper>
      } />
      <Route path="/ConfiguracaoPesagens" element={
        <LayoutWrapper currentPageName="ConfiguracaoPesagens">
          <ConfiguracaoPesagens />
        </LayoutWrapper>
      } />
      <Route path="/Bebedouros" element={
        <LayoutWrapper currentPageName="Bebedouros">
          <Bebedouros />
        </LayoutWrapper>
      } />
      <Route path="/RelatorioGadoMapaGeral" element={
        <LayoutWrapper currentPageName="RelatorioGadoMapaGeral">
          <RelatorioGadoMapaGeral />
        </LayoutWrapper>
      } />
      <Route path="/RelatorioEstoqueDepositos" element={
        <LayoutWrapper currentPageName="RelatorioEstoqueDepositos">
          <RelatorioEstoqueDepositos />
        </LayoutWrapper>
      } />
      <Route path="/DiagnosticoDepositoCocho" element={
        <LayoutWrapper currentPageName="DiagnosticoDepositoCocho">
          <DiagnosticoDepositoCocho />
        </LayoutWrapper>
      } />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <GlobalRequiredFieldsGuard />
        <GlobalDeleteBlockDialog />
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App