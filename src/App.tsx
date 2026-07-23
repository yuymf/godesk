import { CreationPrototype } from "./manila/CreationPrototype";
import { PlayerPlatformFlow } from "./platform/PlayerPlatformFlow";

export default function App() {
  const query = new URLSearchParams(window.location.search);
  return query.get("devAuthoring") === "1"
    ? <CreationPrototype />
    : <PlayerPlatformFlow />;
}
