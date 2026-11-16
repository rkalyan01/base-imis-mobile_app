import React, { useEffect, useRef, useState } from "react";
import "react-native-gesture-handler";
import { Provider as StoreProvider } from "react-redux";
import { Provider as PaperProvider } from "react-native-paper";
import { PersistGate } from "redux-persist/integration/react";
import { persistStore } from "redux-persist";

import store from "./src/store";
import theme from "./src/core/theme";

import AppNavigation from "./src/navigation";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SheetProvider } from "react-native-actions-sheet";
import BootSplash from "react-native-bootsplash";
import "./src/sheets/sheets";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadBaseUrl } from "./src/constants/config";
import { resetToken } from "./src/store/slices/auth.slice";
const persistor = persistStore(store);
const App = () => {
  // Nothing renders until the server URL is known, so no screen can call the
  // API with the wrong one. The splash screen stays up meanwhile.
  const [baseUrlReady, setBaseUrlReady] = useState(false);
  const serverChanged = useRef(false);

  useEffect(() => {
    loadBaseUrl()
      .then((result) => {
        serverChanged.current = result.changed;
      })
      .catch((e) => console.log("loadBaseUrl failed", e))
      .finally(async () => {
        setBaseUrlReady(true);
        await BootSplash.hide({ fade: true });
      });
  }, []);

  // Runs after the saved state is restored. A login from a different server is
  // useless here, so drop it quietly instead of sending it to the new server.
  const dropLoginIfServerChanged = async () => {
    if (!serverChanged.current) return;
    await AsyncStorage.removeItem("token").catch(() => {});
    store.dispatch(resetToken());
  };

  if (!baseUrlReady) return null;

  return (
    <GestureHandlerRootView style={styles.container}>
      <StoreProvider store={store}>
        <PersistGate
          persistor={persistor}
          loading={null}
          onBeforeLift={dropLoginIfServerChanged}
        >
          <PaperProvider theme={theme}>
            <SheetProvider>
              <AppNavigation />
            </SheetProvider>
          </PaperProvider>
        </PersistGate>
      </StoreProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
