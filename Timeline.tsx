import {
  extract as extractOEmbed,
  hasProvider as hasOEmbedProvider,
  RichTypeData,
} from "@extractus/oembed-extractor";
import { MatrixEvent } from "matrix-js-sdk";
import { Box, Column, Link, Row, Text, View } from "native-base";
import { useMemo } from "react";
import useSWR from "swr";

import { groupBy } from "./utils";

function Embed({ url }: { url: string }) {
  const { data } = useSWR(url, () => extractOEmbed(url, { maxheight: 300 }));
  const type = data?.type;
  if (type !== "rich" && type !== "video") {
    return null;
  }
  const { title, html } = data as RichTypeData;
  const urlObject = new URL(url);
  return (
    <Column px="4" py="2" borderColor="black" borderWidth="1px">
      <Link href={url} isExternal rel="noopener">
        {urlObject.protocol == "https:" && "🔒"}
        {urlObject.host}
        {" - "}
        {title}
      </Link>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </Column>
  );
}

function Message({
  message,
  sender,
  timeString,
}: {
  message: MatrixEvent;
  sender: string | null;
  timeString: string | null;
}) {
  const body = message.getContent().body as string;
  const embeddableURLs = useMemo(
    () => body.split(" ").filter((str) => hasOEmbedProvider(str)),
    [body]
  );

  return (
    <Box>
      {sender && (
        <Box>
          <Text bold>{sender}</Text>
        </Box>
      )}
      <Row>
        <Box w="50px">{timeString && <Text italic>{timeString}</Text>}</Box>
        {body}
      </Row>
      {embeddableURLs.map((url, i) => (
        <Embed key={i} {...{ url }} />
      ))}
    </Box>
  );
}

export function Timeline({ messages }: { messages: MatrixEvent[] }) {
  return (
    <>
      {groupBy(
        messages,
        (event) => event.getDate().toISOString().split("T")[0]
      ).map(([day, events], i) => {
        let prevTimeString = null as null | string;
        let prevSender = null as null | string;
        return (
          <Column key={i} w="100%">
            <Row alignItems="center">
              <View style={{ flex: 1, height: 1, backgroundColor: "black" }} />
              <View>
                <Text style={{ paddingHorizontal: 8, textAlign: "center" }}>
                  {new Date(day).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </Text>
              </View>
              <View style={{ flex: 1, height: 1, backgroundColor: "black" }} />
            </Row>
            {events.map((message, i) => {
              let timeString = message
                .getDate()
                .toLocaleTimeString()
                .split(":")
                .slice(0, -1)
                .join(":");
              if (timeString == prevTimeString) {
                timeString = null;
              } else {
                prevTimeString = timeString;
              }

              let sender = message.getSender();
              if (sender == prevSender) {
                sender = null;
              } else {
                prevSender = sender;
              }
              return (
                <Message
                  key={message.getId()}
                  {...{ message, timeString, sender }}
                />
              );
            })}
          </Column>
        );
      })}
    </>
  );
}
