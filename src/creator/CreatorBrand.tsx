import { href } from "./studio-utils";
import gameMarkUrl from "../assets/godesk-mark.svg?no-inline";

export function GameMark() {
  return (
    <img alt="" aria-hidden="true" className="godesk-mark" height="32" src={gameMarkUrl} width="32" />
  );
}

export function Brand() {
  return (
    <a className="creator-brand" href={href("/")}>
      <span aria-hidden="true"><GameMark /></span>
      <strong>GoDesk</strong>
    </a>
  );
}
