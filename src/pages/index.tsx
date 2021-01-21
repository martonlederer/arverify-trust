import Arweave from "arweave";
import { useState, useEffect } from "react";
import moment from "moment";
import { all } from "ar-gql";
import verificationsQuery from "../queries/verifications";
import {
  useModal,
  useToasts,
  useClipboard,
  Page,
  Row,
  Breadcrumbs,
  Text,
  Button,
  Card,
  Dot,
  Spacer,
  Modal,
} from "@geist-ui/react";
import { FileIcon, ClippyIcon, ClockIcon } from "@primer/octicons-react";

const client = new Arweave({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

const Home = () => {
  const [addr, setAddr] = useState("");
  useEffect(() => {
    (async () => {
      const keyfile = localStorage.getItem("keyfile");
      if (keyfile) {
        setAddr(await client.wallets.jwkToAddress(JSON.parse(keyfile)));
      }
    })();
  }, []);
  const { setVisible, bindings } = useModal();

  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState("warning");
  const [percentage, setPercentage] = useState(0);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState("");
  const [count, setCount] = useState(0);

  const fetchData = async () => {
    const raw = await fetch(
      `https://arverify-trust.herokuapp.com/score/${addr}`
    );
    const res = await raw.clone().json();

    const status = res.status;

    if (status === "FETCHED") {
      setFailed(false);
      setStatus("success");

      setPercentage(parseFloat(res.percentage.toFixed(2)));
      setScore(res.score);

      const now = moment();
      const then = moment(res.updated_at);
      const diff = moment.duration(-now.diff(then));
      setTime(diff.humanize(true));

      const gql = await all(verificationsQuery, { addr });
      setCount(gql.length);
    }
    if (status === "SUBMITTED") {
      setStatus("warning");
    }
    if (status === "UNKNOWN") {
      setFailed(true);
    }
  };

  useEffect(() => {
    if (addr !== "" && !failed) {
      (async () => {
        setLoading(true);
        await fetchData();
        setLoading(false);

        setInterval(async () => {
          await fetchData();
        }, 60000);
      })();
    }
  }, [addr, failed]);

  const [, setToast] = useToasts();
  const { copy } = useClipboard();

  return (
    <Page>
      <Row justify="space-between" align="middle">
        <Breadcrumbs size="large">
          <Breadcrumbs.Item href="https://arverify.org">
            ArVerify
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>Trust</Breadcrumbs.Item>
        </Breadcrumbs>
        <Text
          onClick={() => {
            if (addr === "") {
              setVisible(true);
            } else {
              localStorage.removeItem("keyfile");
              setAddr("");
            }
          }}
          style={{ cursor: "pointer" }}
        >
          {addr === "" ? "Log In" : addr}
        </Text>
      </Row>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translateX(-50%) translateY(-50%)",
        }}
      >
        {addr === "" ? (
          <Button type="secondary" onClick={() => setVisible(true)}>
            Log In
          </Button>
        ) : (
          <>
            {failed ? (
              <Button
                type="secondary"
                onClick={async () => {
                  await fetch(`https://arverify-trust.herokuapp.com/score`, {
                    method: "POST",
                    headers: {
                      Accept: "application/json",
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ address: addr }),
                  });
                  setFailed(false);
                }}
              >
                Submit your address
              </Button>
            ) : (
              <Card>
                <Text h2>
                  {/* @ts-ignore */}
                  {/* <Dot type={status} /> */}
                  {`${percentage}%`}
                </Text>
                <Text h4>{count} verifications</Text>
                <Card.Footer>
                  <Text>
                    <Text
                      onClick={() => {
                        copy(`https://trust.arverify.org/verify/${addr}`);
                        setToast({
                          text: "Verification link copied to clipboard.",
                          type: "secondary",
                        });
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <ClippyIcon /> Copy verification link.
                    </Text>
                    <Spacer y={0.5} />
                    <ClockIcon /> {time}
                  </Text>
                </Card.Footer>
              </Card>
            )}
          </>
        )}
      </div>
      <Modal {...bindings}>
        <Modal.Title>Sign In</Modal.Title>
        <Modal.Subtitle style={{ textTransform: "none" }}>
          Use your{" "}
          <a
            href="https://www.arweave.org/wallet"
            target="_blank"
            rel="noopener noreferrer"
          >
            Arweave keyfile
          </a>{" "}
          to continue
        </Modal.Subtitle>
        <Modal.Content>
          <Card
            style={{ border: "1px dashed #333", cursor: "pointer" }}
            onClick={() => document.getElementById("file").click()}
          >
            <FileIcon size={24} /> Upload your keyfile
          </Card>
        </Modal.Content>
        <Modal.Action passive onClick={() => setVisible(false)}>
          Cancel
        </Modal.Action>
      </Modal>
      <input
        type="file"
        id="file"
        accept=".json,application/json"
        onChange={(ev) => {
          const reader = new FileReader();
          reader.onload = async () => {
            const jwk = JSON.parse(reader.result.toString());
            const addr = await client.wallets.jwkToAddress(jwk);

            localStorage.setItem("keyfile", JSON.stringify(jwk));
            setAddr(addr);
            setVisible(false);
          };
          reader.readAsText(ev.target.files[0]);
        }}
      />
      <style jsx>{`
        #file {
          opacity: 0;
        }
      `}</style>
    </Page>
  );
};

export default Home;
