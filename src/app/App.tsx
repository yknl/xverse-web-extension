import { ThemeProvider } from 'styled-components';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SnackbarProvider from 'react-simple-snackbar';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import rootStore from '@stores/index';
import LoadingScreen from '@components/loadingScreen';
import Theme from '../theme';
import GlobalStyle from '../theme/global';
import '../locales';
import router from './routes';

function App(): JSX.Element {
  const queryClient = new QueryClient();
  return (
    <SnackbarProvider>
      <GlobalStyle />
      <QueryClientProvider client={queryClient}>
        <Provider store={rootStore.store}>
          <PersistGate persistor={rootStore.persistedStore} loading={<LoadingScreen />}>
            <ThemeProvider theme={Theme}>
              <RouterProvider router={router} />
            </ThemeProvider>
          </PersistGate>
        </Provider>
      </QueryClientProvider>
    </SnackbarProvider>
  );
}

export default App;
