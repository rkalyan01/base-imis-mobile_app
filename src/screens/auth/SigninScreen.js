import {
  Image,
  Alert,
  Keyboard,
  ScrollView,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  ToastAndroid,
  View,
  StatusBar,
} from "react-native";
import {
  Text,
  Title,
  Button,
  Checkbox,
  TextInput,
  HelperText,
} from "react-native-paper";
import { useDispatch, useSelector } from "react-redux";
import React, { useEffect, useRef, useState } from "react";
import DeviceInfo from "react-native-device-info";

import {
  storeAccount,
  storePermissions,
  storeToken,
  storeUsername,
} from "../../store/slices/auth.slice";
import { loginService } from "../../service/auth_service";

import { COLORS, SPACINGS } from "../../core/theme";
import { IMAGES } from "../../core/constants/images";
import { ROUTES } from "../../core/constants/routes";

import VerticalSpacer from "../../components/common/VerticalSpacer";
import { setValue } from "../../helpers/localstorage";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Spacer } from "../../components/Layout";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcon from "react-native-vector-icons/MaterialIcons";
import {
  getBaseUrl,
  getServer,
  switchToNextServer,
} from "../../constants/config";

const SigninScreen = ({ navigation }) => {
  const emailRef = useRef();
  const passwordRef = useRef();
  const dispatch = useDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [pwdHidden, setPwdHidden] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);

  const [server, setServer] = useState(getServer());

  const { username } = useSelector((state) => state.auth);
  const buildNumber = DeviceInfo.getVersion();

  useEffect(() => {
    if (username) {
      setRememberMe(true);
      setEmail(username);
    }
  }, []);

  const toggleRememberMe = () => {
    setRememberMe(!rememberMe);
  };

  // Tapping the address under the version moves to the next server.
  const onServerPressed = async () => {
    setServer(await switchToNextServer());
    // A token left from another server must never be sent to this one.
    await AsyncStorage.removeItem("token").catch(() => {});
  };

  const onLoginPressed = () => {
    Keyboard.dismiss();
    if (!getBaseUrl()) {
      Alert.alert(
        "Server not available",
        "The server address could not be loaded. Check the internet connection or choose another server."
      );
      return;
    }
    const isValid = validateLoginDetails();
    if (isValid) {
      login();
    }
  };

  const validateLoginDetails = () => {
    setEmailError(null);
    setPasswordError(null);

    if (email === "") {
      setEmailError("Email address is required");
      emailRef.current.focus();

      return false;
    }

    if (password === "") {
      setPasswordError("Password is required*");
      passwordRef.current.focus();

      return false;
    }

    return true;
  };

  const login = async () => {
    setIsLoading(true);

    loginService({ email, password })
      .then((res) => {
        const { status, token, data, error } = res.data;

        console.log("login==>>", res.data?.data?.permissions);

        if (status) {
          setValue("token", token);
          dispatch(storePermissions(data?.permissions));
          dispatch(storeAccount(data));
          dispatch(storeToken(token));

          if (rememberMe) {
            dispatch(storeUsername(email));
          } else {
            dispatch(storeUsername(null));
          }

          setIsLoading(false);
          // navigation.replace(ROUTES.root_stack);
        } else {
          // new Error(error);

          if (error?.login) {
            Alert.alert("Login failed", "Email or password is incorrect");
            return;
          }
        }
      })
      .catch((err) => {
        setIsLoading(false);

        console.log("errr", err?.response?.data);
        const errorMessage = err?.response?.data?.message;

        if (errorMessage) {
          Alert.alert(null, errorMessage);
          return;
        }
      });
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      <StatusBar backgroundColor={"#FFFFFF"} barStyle="dark-content" />

      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollView}
      >
        <VerticalSpacer size={60} />
        <Image source={IMAGES.fulllogo} style={styles.logo} />
        <VerticalSpacer size={20} />
        <TextInput
          value={email}
          mode="outlined"
          label="Email Address"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect={false}
          ref={emailRef}
          returnKeyType="next"
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="e.g. email@address.com"
          error={emailError ? true : false}
          onSubmitEditing={() => passwordRef.current.focus()}
        />
        {emailError && (
          <HelperText style={styles.errorText}>{emailError}</HelperText>
        )}
        <VerticalSpacer />
        <TextInput
          mode="outlined"
          ref={passwordRef}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          label="Password"
          returnKeyType="done"
          placeholder="*********"
          onChangeText={setPassword}
          secureTextEntry={pwdHidden}
          error={passwordError ? true : false}
          right={
            <TextInput.Icon
              icon={pwdHidden ? "eye" : "eye-off"}
              onPress={() => setPwdHidden(!pwdHidden)}
            />
          }
        />
        {passwordError && (
          <HelperText style={styles.errorText}>{passwordError}</HelperText>
        )}
        <VerticalSpacer />
        <TouchableOpacity
          activeOpacity={0.6}
          style={styles.checkboxRow}
          onPress={toggleRememberMe}
        >
          <Checkbox
            color={COLORS.primary}
            status={rememberMe ? "checked" : "unchecked"}
            onPress={toggleRememberMe}
          />
          <Text>Remember me</Text>
        </TouchableOpacity>
        <VerticalSpacer size={15} />
        <Button
          icon="login"
          mode="contained"
          loading={isLoading}
          disabled={isLoading}
          onPress={onLoginPressed}
          contentStyle={styles.btnContentStyle}
        >
          Log In
        </Button>

        <View style={styles.footer}>
          <Text style={styles.buildNumber}>{buildNumber ?? ""}</Text>
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={onServerPressed}
            disabled={isLoading}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.serverSwitch}
          >
            <Text style={styles.serverLabel} numberOfLines={1}>
              {server.label} • {getBaseUrl().replace(/^https:\/\//, "") || "no address"}
            </Text>
            <MaterialIcon name="swap-horiz" size={16} color={COLORS.gray} />
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default SigninScreen;

const size = Dimensions.get("window").width;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    // gap: 16,
  },
  footer: {
    justifyContent: "flex-end",
    alignItems: "center",
    alignSelf: "center",
    flex: 1,
  },

  buildNumber: {
    fontSize: 16,
    color: COLORS.gray,
    paddingTop: 18,
    paddingBottom: 6,
  },
  logo: {
    width: size * 0.9,
    height: size * 0.6,
    resizeMode: "contain",
    alignSelf: "center",
  },

  contentContainer: {
    flex: 1,
    padding: SPACINGS.md,
    justifyContent: "center",
    position: "relative",
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  btnContentStyle: {
    paddingVertical: SPACINGS.xxs,
  },

  errorText: {
    color: COLORS.error,
  },

  serverSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderRadius: 20,
    backgroundColor: "#EEEEEE",
  },
  serverLabel: {
    fontSize: 12,
    color: COLORS.gray,
  },
});
