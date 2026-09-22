import { href } from "./studio-utils";

export function Brand() {
  return (
    <a className="creator-brand" href={href("/")}>
      <span aria-hidden="true">GD</span>
      <span>
        <strong>GoDesk</strong>
        <small>写想法，就开玩</small>
      </span>
    </a>
  );
}
