import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import * as sdk from "matrix-js-sdk";
import {
  ClientEvent,
  EventType,
  IndexedDBStore,
  MatrixEvent,
  Room,
  RoomEvent,
} from "matrix-js-sdk";
import { SyncState } from "matrix-js-sdk/lib/sync";
import {
  Button,
  Column,
  FormControl,
  Input,
  NativeBaseProvider,
  Pressable,
  Row,
  Text,
  TextArea,
} from "native-base";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import useAsyncEffect from "use-async-effect";
import { z } from "zod";
import { Timeline } from "./Timeline";

global.Olm = require("olm");

const SessionSchema = z.object({
  access_token: z.string(),
  device_id: z.string(),
  home_server: z.string(),
  user_id: z.string(),
});

const storageKeySchemas = { session: SessionSchema };

const saveToStorage = async <K extends keyof typeof storageKeySchemas>(
  key: K,
  value: unknown
) => {
  const parsedValue = storageKeySchemas[key].parse(value);
  await AsyncStorage.setItem(key, JSON.stringify(parsedValue));
};
const loadFromStorage = async <K extends keyof typeof storageKeySchemas>(
  key: K
): Promise<z.infer<typeof storageKeySchemas[K]> | null> => {
  const value = await AsyncStorage.getItem(key);
  if (!value) {
    return null;
  }
  return storageKeySchemas[key].parse(JSON.parse(value));
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "flex-start",
    justifyContent: "center",
  },
});

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Column>
      <Column mb="2">
        <FormControl.Label>Username</FormControl.Label>
        <Input value={username} onChangeText={setUsername} />
      </Column>

      <Column mb="4">
        <FormControl.Label>Password</FormControl.Label>
        <Input type="password" value={password} onChangeText={setPassword} />
      </Column>

      <Button onPress={() => onLogin(username, password)}>Login</Button>
    </Column>
  );
};

// client.on(RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
//   if (toStartOfTimeline) {
//     return; // don't print paginated results
//   }
//   if (event.getType() !== "m.room.message") {
//     return; // only print messages
//   }
//   console.log(
//     // the room name will update with m.room.name events automatically
//     "(%s) %s :: %s",
//     room.name,
//     event.getSender(),
//     event.getContent().body
//   );
// });

export default function App() {
  const [client, setClient] = useState(() =>
    sdk.createClient({ baseUrl: "https://matrix.org" })
  );
  const [session, setSession] = useState<
    "loading" | "none" | z.infer<typeof SessionSchema>
  >("loading");
  const [isSyncPrepared, setIsSyncPrepared] = useState(false);

  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [activeMessages, setActiveMessages] = useState<MatrixEvent[]>([]);
  const [draft, setDraft] = useState("");

  useAsyncEffect(async () => {
    if (session !== "loading") {
      return;
    }
    const sessionValue = await loadFromStorage("session");
    if (!sessionValue) {
      setSession("none");
      return;
    }
    setSession(sessionValue);
  }, []);

  useAsyncEffect(async () => {
    if (typeof session == "string") {
      return;
    }
    const store = new IndexedDBStore({
      indexedDB: window.indexedDB,
      localStorage: window.localStorage,
    });
    await store.startup();
    const client = sdk.createClient({
      baseUrl: "https://matrix.org",
      userId: session.user_id,
      deviceId: session.device_id,
      accessToken: session.access_token,
      store,
    });

    await client.initRustCrypto(); // initCrypto threw cryptic errors (I'm funny)
    client.once(ClientEvent.Sync, (state) => {
      if (state == SyncState.Prepared) {
        setIsSyncPrepared(true);
      }
    });
    await client.startClient();
    setClient(client);
  }, [session]);

  useEffect(() => {
    if (!activeRoom) {
      setActiveMessages([]);
      return;
    }
    const handleTimelineEvent = () => {
      setActiveMessages(
        activeRoom.timeline.filter((event) => event.getContent().body)
      );
    };
    handleTimelineEvent();
    client.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      client.off(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [activeRoom]);

  return (
    <NativeBaseProvider>
      <View style={styles.container}>
        <Row w="100vw" h="100vh" p="5">
          <Column w={400}>
            {isSyncPrepared &&
              client
                .getRooms()
                .filter((room) => room.name)
                .map((room) => (
                  <Pressable
                    key={room.roomId}
                    mb="4"
                    onPress={() => {
                      setActiveRoom(room);
                    }}
                  >
                    <Text bold={room == activeRoom}>{room.name}</Text>
                  </Pressable>
                ))}
          </Column>
          {activeRoom && (
            <Column flexShrink={1} justifyContent="space-between" maxH="100vh">
              <Text overflowY="auto" overflowWrap="anywhere">
                <Timeline messages={activeMessages} />
              </Text>
              <TextArea
                placeholder="Send a message..."
                value={draft}
                onChangeText={setDraft}
                onKeyPress={(event) => {
                  if (
                    event.nativeEvent.key == "Enter" &&
                    !event.nativeEvent.shiftKey
                  ) {
                    client.sendEvent(activeRoom.roomId, EventType.RoomMessage, {
                      msgtype: "m.text",
                      body: draft,
                    });
                    setDraft("");
                    event.preventDefault();
                  }
                }}
              />
            </Column>
          )}
        </Row>
        {session == "none" && (
          <LoginForm
            onLogin={async (username, password) => {
              const session = await client.loginWithPassword(
                username,
                password
              );
              await saveToStorage("session", session);
              setSession(session);
            }}
          />
        )}
        <StatusBar style="auto" />
      </View>
    </NativeBaseProvider>
  );
}
