"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent } from "react";
import {
  createTouringShow,
  exampleTransport,
  savePromoterDetails,
  touringEvidence,
  touringTime,
  type TouringEvidence,
  type TouringField,
  type TouringShow,
} from "../lib/touring-engine/demo.mjs";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

type View = "manager" | "promoter" | "artist";
type Props = { embedded?: boolean };
const views: { id: View; label: string }[] = [
  { id: "manager", label: "Manager" },
  { id: "promoter", label: "Promoter" },
  { id: "artist", label: "Artist" },
];

function savedValue(show: TouringShow, key: string) {
  const value: unknown = Reflect.get(show, key);
  return typeof value === "string" ? value : "";
}

function PromoterForm({ show, evidence, onSave }: {
  show: TouringShow;
  evidence: TouringEvidence;
  onSave: (fields: Record<string, string>) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  const [message, setMessage] = useState("");
  const transport = evidence.promoterFields.filter(f => f.section === "Transport");
  const otherKeys = ["venue_name", "venue_address", "set_time", "dos_name", "dos_number"];
  const other = evidence.promoterFields.filter(f => otherKeys.includes(f.key));
  function field(f: TouringField) {
    const missing = evidence.outstanding.some(item => item.key === f.key);
    return (
      <label className="portfolio-touring-field" htmlFor={`${id}-${f.key}`} key={f.key}>
        <span>{f.label}{missing && <small>Still needed</small>}</span>
        {f.key.startsWith("transfer_") ? (
          <textarea defaultValue={savedValue(show, f.key)} id={`${id}-${f.key}`} maxLength={500} name={f.key} rows={2} />
        ) : (
          <input defaultValue={savedValue(show, f.key)} id={`${id}-${f.key}`} maxLength={180} name={f.key} type={f.type === "datetime" ? "datetime-local" : f.key.endsWith("number") ? "tel" : "text"} />
        )}
      </label>
    );
  }
  function fillExample() {
    for (const [key, value] of Object.entries(exampleTransport)) {
      const control = form.current?.elements.namedItem(key);
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) control.value = value;
    }
    setMessage("Example details filled in. Save to update the show.");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fields = Object.fromEntries([...data].filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    onSave(fields);
  }
  return (
    <form className="portfolio-touring-form" onSubmit={submit} ref={form}>
      <div className="portfolio-touring-section-head">
        <div><h3>Show advance</h3><p>Supply the missing transport details, or update what is already here.</p></div>
        <button className="portfolio-touring-text-action" onClick={fillExample} type="button">Use example details</button>
      </div>
      <fieldset><legend>Transport</legend>{transport.map(field)}</fieldset>
      <details className="portfolio-touring-disclosure">
        <summary>Venue, set time &amp; day-of contact</summary>
        <div className="portfolio-touring-form-extra">{other.map(field)}</div>
      </details>
      <p aria-live="polite" className="portfolio-touring-feedback">{message}</p>
      <button className="portfolio-touring-primary" type="submit">Save advance</button>
    </form>
  );
}

function DaySheet({ evidence, id, show }: { evidence: TouringEvidence; id: string; show: TouringShow }) {
  return (
    <section aria-label="Day sheet" className="portfolio-touring-daysheet" id={id} tabIndex={-1}>
      <div className="portfolio-touring-section-head"><div><h3>Day sheet</h3><p>{show.venue_name} · {evidence.date}</p></div></div>
      <div className="portfolio-touring-day-sections">
        {evidence.daySheet.sections.map(section => (
          <section className="portfolio-touring-day-section" key={section.section}>
            <h4>{section.section}</h4>
            <dl>{section.fields.map(f => (
              <div data-missing={!f.value || undefined} key={f.label}>
                <dt>{f.label === "Landing Time" ? "Arrival for show" : f.label === "Takeoff Time" ? "Departure after show" : f.label}</dt><dd>{f.value || "Not yet supplied"}</dd>
              </div>
            ))}</dl>
          </section>
        ))}
      </div>
    </section>
  );
}

export function TouringDemo({ embedded = false }: Props) {
  const ready = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [show, setShow] = useState(createTouringShow);
  const [view, setView] = useState<View>("manager");
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  const [eventKey, setEventKey] = useState("set");
  const [artistView, setArtistView] = useState<"day-sheet" | "calendar">("day-sheet");
  const id = useId();
  const sheetId = `${id}-day-sheet`;
  const panelRef = useRef<HTMLDivElement>(null);
  const evidence = useMemo(() => touringEvidence(show, `#${sheetId}`), [show, sheetId]);
  const activeEvent = evidence.events.find(event => event.key === eventKey);
  const Root = embedded ? "section" : "main";
  const Heading = embedded ? "h2" : "h1";
  const complete = evidence.outstanding.length === 0;

  function navigate(next: View, focus = false) {
    setView(next);
    if (focus) requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
  }
  function save(fields: Record<string, string>) {
    const next = savePromoterDetails(show, fields);
    const nextEvidence = touringEvidence(next);
    const changed = Object.keys(fields).filter(key => savedValue(next, key) !== savedValue(show, key));
    setShow(next);
    setSaved(true);
    setFormVersion(version => version + 1);
    setNotice(changed.length ? `${changed.length} ${changed.length === 1 ? "detail" : "details"} saved. ${nextEvidence.outstanding.length === 0 ? "The advance is complete." : `${nextEvidence.outstanding.length} still needed.`}` : "No details changed.");
    navigate("manager", true);
  }
  function reset() {
    setShow(createTouringShow());
    setSaved(false);
    setNotice("Show reset. Two transport details still needed.");
    setFormVersion(version => version + 1);
    setEventKey("set");
    setArtistView("day-sheet");
    navigate("manager");
  }
  function openDaySheet(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setArtistView("day-sheet");
    requestAnimationFrame(() => {
      const sheet = document.getElementById(sheetId);
      sheet?.scrollIntoView({ behavior: "instant", block: "start" });
      sheet?.focus({ preventScroll: true });
    });
  }
  return (
    <div className={embedded ? "portfolio-touring-embed" : "portfolio-composition portfolio-touring-page"}>
      {!embedded && <Link className="portfolio-touring-return" href="/?view=graph#touring">← Tour Advancing System</Link>}
      <Root aria-busy={!ready} aria-label="Tour advancing demo" inert={!ready} className="portfolio-touring" data-embedded={embedded || undefined} id={embedded ? undefined : "main-content"}>
        <div className="portfolio-touring-topline"><span>Interactive demo</span><button onClick={reset} type="button">Reset</button></div>
        <header className="portfolio-touring-header">
          <div><Heading>{show.artist}</Heading><p>{show.venue_name} · {evidence.date}</p></div>
          <span className="portfolio-touring-status" data-complete={complete}>{complete ? "Ready for show day" : "Waiting on promoter"}</span>
        </header>
        <nav aria-label="Show views" className="portfolio-touring-nav">
          {views.map(item => <button aria-current={view === item.id ? "page" : undefined} key={item.id} onClick={() => navigate(item.id)} type="button">{item.label}</button>)}
        </nav>
        <p aria-live="polite" className="portfolio-touring-notice">{notice}</p>
        <div className="portfolio-touring-panel" ref={panelRef} tabIndex={-1}>
          {view === "manager" && <>
            <section className="portfolio-touring-overview">
              <div className="portfolio-touring-section-head"><div><h3>{complete ? "The advance is complete" : `${evidence.outstanding.length} ${evidence.outstanding.length === 1 ? "detail" : "details"} still needed`}</h3><p>{complete ? "The artist’s day sheet now includes the promoter’s answers." : "The show is booked. Ground transport is the last open item."}</p></div></div>
              {!complete && <ul className="portfolio-touring-outstanding">{evidence.outstanding.map(f => <li key={f.key}><span>{f.label}</span><span>Promoter</span></li>)}</ul>}
              {saved && <dl className="portfolio-touring-saved"><div><dt>Driver</dt><dd>{show.driver_name || "Still needed"}</dd></div><div><dt>Airport pickup</dt><dd>{show.transfer_airport_hotel || "Still needed"}</dd></div></dl>}
              <div className="portfolio-touring-actions"><button className="portfolio-touring-primary" onClick={() => navigate(complete ? "artist" : "promoter", true)} type="button">{complete ? "See the artist’s day sheet" : "Open the promoter form"} →</button>{saved && !complete && <button className="portfolio-touring-text-action" onClick={() => navigate("artist", true)} type="button">See the artist’s view</button>}</div>
            </section>
            <section className="portfolio-touring-record">
              <h4>Show record</h4>
              <dl><div><dt>Set time</dt><dd>{evidence.setTime}</dd></div><div><dt>Day-of contact</dt><dd>{show.dos_name} · {show.dos_number}</dd></div><div><dt>Transport</dt><dd>Included</dd></div><div><dt>Hotel</dt><dd>Artist-arranged</dd></div></dl>
            </section>
            <details className="portfolio-touring-disclosure" open={!complete}>
              <summary>Promoter follow-up{evidence.draft ? " · Draft" : ""}</summary>
              {evidence.draft ? <div className="portfolio-touring-message"><p>To {show.dos_name}</p><div>{evidence.draft}</div></div> : <p className="portfolio-touring-empty">No follow-up needed. The required details are in.</p>}
            </details>
          </>}
          {view === "promoter" && <PromoterForm evidence={evidence} key={formVersion} onSave={save} show={show} />}
          {view === "artist" && <>
            <nav aria-label="Artist information" className="portfolio-touring-event-nav">
              <button aria-current={artistView === "day-sheet" ? "page" : undefined} onClick={() => setArtistView("day-sheet")} type="button">Day sheet</button>
              <button aria-current={artistView === "calendar" ? "page" : undefined} onClick={() => setArtistView("calendar")} type="button">Calendar</button>
            </nav>
            {artistView === "day-sheet" ? <DaySheet evidence={evidence} id={sheetId} show={show} /> :
            <section aria-label="Artist calendar" className="portfolio-touring-calendar">
              <div className="portfolio-touring-section-head"><div><h3>Artist calendar</h3><p>Confirmed times, carried through from the show record.</p></div></div>
              <nav aria-label="Calendar events" className="portfolio-touring-event-nav">{evidence.events.map(event => <button aria-current={event.key === eventKey ? "true" : undefined} key={event.key} onClick={() => setEventKey(event.key)} type="button">{event.key === "set" ? "Set" : event.key === "arrival" ? "Arrival" : "Departure"}</button>)}</nav>
              {activeEvent && <article className="portfolio-touring-event"><h4>{activeEvent.summary}</h4><p>{touringTime(activeEvent.start, activeEvent.timezone)}<br />to {touringTime(activeEvent.end, activeEvent.timezone)}</p><dl><div><dt>Venue</dt><dd>{show.venue_name}<br />{show.venue_address}</dd></div><div><dt>Contact</dt><dd>{show.dos_name}<br />{show.dos_number}</dd></div></dl><a href={`#${sheetId}`} onClick={openDaySheet}>Open day sheet ↗︎</a></article>}
            </section>}
          </>}
        </div>
        <footer className="portfolio-touring-footer">Changes stay in this demo. Email and calendar delivery are disconnected.</footer>
      </Root>
    </div>
  );
}
