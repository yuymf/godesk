import type { DefaultExampleId } from "./default-examples";

/** Hero / card artwork. Tidewell uses a static WebP poster (G3D-16) — never mount SceneHost here. */
export function ExampleArtwork({ exampleId }: { exampleId: DefaultExampleId }) {
  if (exampleId === "tidewell-isles") {
    return (
      <div aria-hidden="true" className="example-artwork example-artwork-tidewell-isles">
        <img
          alt=""
          decoding="async"
          height={540}
          src="/lobby/tidewell-hero.webp"
          width={960}
        />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={`example-artwork example-artwork-${exampleId}`}>
      <svg fill="none" viewBox="0 0 360 230">
        {exampleId === "harbor-13" && <>
          <path d="M0 65h360M0 115h360M0 165h360M45 0v230M120 0v230M195 0v230M270 0v230M345 0v230" stroke="#fff" strokeOpacity=".25" />
          <path d="M26 32h308v34H26z" fill="#e9dbc3" />
          {[70, 180, 290].map((x, i) => <g key={x}>
            <path d={`M${x - 32} 92h64v89l-32 28-32-28z`} fill={["#ce7052", "#f1be5f", "#779b87"][i]} />
            <path d={`M${x - 25} 171h50l-25 23z`} fill="#163d50" fillOpacity=".18" />
            <rect fill="#fff" fillOpacity=".8" height="22" rx="3" width="22" x={x - 11} y="123" />
            <circle cx={x} cy="134" fill="#163d50" r="3" />
            <circle cx={x} cy="49" fill="#163d50" r="9" />
          </g>)}
          <path d="M9 214q9-5 18 0t18 0M327 90q9-5 18 0t18 0" stroke="#fff" strokeOpacity=".55" strokeWidth="2" />
        </>}
        {exampleId === "mistpeak-lodge" && <>
          <path d="M0 201l90-90 71 57 86-114 113 147" fill="#85877d" fillOpacity=".25" />
          <g transform="rotate(-14 106 115)">
            <rect fill="#aebeac" height="148" rx="12" width="100" x="56" y="40" />
            <circle cx="106" cy="100" fill="#52634f" r="20" /><path d="M78 152q0-30 28-30t28 30" fill="#52634f" />
          </g>
          <g transform="rotate(14 254 115)">
            <rect fill="#acaa9e" height="148" rx="12" width="100" x="204" y="40" />
            <path d="M237 83h34v13h-34zM244 70h20v27h-20z" fill="#55584e" /><circle cx="254" cy="113" fill="#55584e" r="16" /><path d="M226 158q0-25 28-25t28 25" fill="#55584e" />
          </g>
          <rect fill="#faf8f0" height="164" rx="12" width="112" x="124" y="34" />
          <path d="M155 91q25-33 50 0v25l-25 32-25-32z" fill="#4f6055" />
          <path d="M162 103l12 5m12 0 12-5M173 129h14" stroke="#faf8f0" strokeLinecap="round" strokeWidth="3" />
          <path d="M167 174h26" stroke="#aebeac" strokeLinecap="round" strokeWidth="4" />
        </>}
        {exampleId === "idea-relay" && <>
          <circle cx="303" cy="34" fill="#e4b58a" r="64" />
          <circle cx="35" cy="206" fill="#c69d87" r="60" />
          <rect fill="#fffcf5" height="61" rx="14" width="218" x="30" y="35" />
          <circle cx="57" cy="65" fill="#ce7052" r="11" />
          <path d="M80 57h109M80 73h140" stroke="#bdada1" strokeLinecap="round" strokeWidth="6" />
          <path d="M87 107h220v60H114l-27 15z" fill="#774e3b" />
          <path d="M113 127h152M113 144h118" stroke="#f4e2c9" strokeLinecap="round" strokeWidth="6" />
          <rect fill="#fffcf5" height="39" rx="14" width="143" x="38" y="184" />
          {[77, 109, 141].map((cx) => <circle cx={cx} cy="203" fill="#bdada1" key={cx} r="4" />)}
        </>}
      </svg>
    </div>
  );
}
