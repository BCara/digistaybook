import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  dateRangeLabels,
  defaultMemoryFilter,
  defaultMemorySort,
  filterMemories,
  nextSort,
  sortMemories,
  statusFilterLabels,
  type DateRange,
  type MemoryFilter,
  type MemorySort,
  type MemorySortKey,
  type StatusFilter
} from "../../domain/memoryTable";
import {
  actionCopy,
  actionsUnavailable,
  availableActions,
  holdSla,
  holdSummary,
  primaryAction,
  type ModeratedPost,
  type PostAction
} from "../../domain/postModeration";
import { formatDate } from "../wall/demoWall";
import type { QueueState } from "./useModerationQueue";
import type { FeedEntry } from "./useInboxFeed";
import type { HostProperty } from "./propertyStore";

/**
 * The wall, as the Host who owns it works through it.
 *
 * Every memory is drawn the way a guest would meet it — the photograph, the
 * message in the guest's own words, who wrote it — because a moderation
 * decision made from a truncated row in a table is a decision made blind. What
 * is added around it is only what a guest never sees: why it is off the wall,
 * how long is left on it, and what may be done about it.
 */

/** Line marks drawn beside an action's words. Never the only label. */
function Mark({ children, filled = false }: { children: ReactNode; filled?: boolean }) {
  return (
    <svg className={`queue-mark${filled ? " is-filled" : ""}`} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
const star = <path d="m10 2.6 2.3 4.7 5.1.7-3.7 3.6.9 5.1L10 14.3l-4.6 2.4.9-5.1L2.6 8l5.1-.7Z" />;
const actionMarks: Partial<Record<PostAction, ReactNode>> = {
  pin: <Mark><path d="M7 2.8h6M8 2.8v5.4L5.4 11h9.2L12 8.2V2.8M10 11v6.2" /></Mark>,
  unpin: <Mark>{star}</Mark>,
  publish: <Mark><path d="M2.2 10S5 4.8 10 4.8s7.8 5.2 7.8 5.2-2.8 5.2-7.8 5.2S2.2 10 2.2 10Z" /><circle cx="10" cy="10" r="2.3" /></Mark>,
  delete: <Mark><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.2 5.5l.8 11h8l.8-11" /></Mark>
};

/**
 * What a memory's state is, in a pill. A memory that is simply on the wall
 * gets none: its section already says so, and a pill on every row of a long
 * wall is a label repeated until no one reads it.
 */
function StateLabel({ post, always = false }: {
  post: ModeratedPost;
  /** In a table every row has a status column, so a plain live memory says so too. */
  always?: boolean;
}) {
  const sla = holdSla(post);
  const label =
    post.visibility === "visible" ? (post.pinned ? "Pinned" : always ? "On the wall" : null) :
    post.visibility === "hidden_pending_review" ? "Hidden, waiting on you" :
    post.visibility === "hidden_by_host" ? "Off the wall" :
    post.visibility === "restricted" ? "Held by DigiStayBook" :
    "Deleted";

  if (!label && !sla) return null;
  return (
    <p className="queue-state">
      {label && (
        <span className={`state-pill visibility-${post.visibility}${post.pinned ? " is-pinned" : ""}`}>
          {post.pinned && post.visibility === "visible" && <Mark filled>{star}</Mark>}
          {label}
        </span>
      )}
      {sla && (
        // The deadline is shown even once it has passed, because "escalated
        // three days ago" is the thing a Host most needs to know and least
        // wants a page to be tactful about.
        <span className={`state-pill sla${sla.overdue ? " sla-overdue" : ""}`}>
          {sla.overdue
            ? `${Math.abs(sla.daysLeft)} ${Math.abs(sla.daysLeft) === 1 ? "day" : "days"} past the deadline`
            : `${sla.daysLeft} ${sla.daysLeft === 1 ? "day" : "days"} left to resolve`}
        </span>
      )}
    </p>
  );
}

/**
 * One action in the open, the rest behind "More".
 *
 * Four equal buttons on every row of a long wall was a page of buttons: the
 * Host had to read each row's controls to find the one they came for. The
 * action a memory leads with — pin a live one, publish a hidden one, delete a
 * privacy request — stays a button; the occasional ones fold away.
 */
function ActionButtons({
  post,
  state,
  actions
}: {
  post: ModeratedPost;
  state: QueueState;
  actions: PostAction[];
}) {
  const lead = primaryAction(post);
  const rest = actions.filter((action) => action !== lead);
  const busy = state.working?.postId === post.id;
  const menu = useRef<HTMLDetailsElement>(null);

  // A menu left open after the Host has clicked elsewhere is a menu they
  // have to remember to close.
  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      const details = menu.current;
      if (!details?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !details.contains(event.target as Node)) {
        details.open = false;
      }
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const run = (action: PostAction) => {
    if (menu.current) menu.current.open = false;
    if (actionCopy[action].confirm) state.ask(post, action);
    else void state.act(post, action);
  };
  const label = (action: PostAction) =>
    busy && state.working?.action === action ? "Working…" : actionCopy[action].label;

  return (
    <div className="queue-actions">
      {lead && (
        <button
          type="button"
          className={`queue-lead${actionCopy[lead].destructive ? " is-destructive" : ""}`}
          // Only this memory's buttons go quiet while its own action is in
          // flight; the rest of the queue stays workable.
          disabled={busy}
          onClick={() => run(lead)}
        >
          {actionMarks[lead]}
          {label(lead)}
        </button>
      )}
      {rest.length > 0 && (
        <details className="queue-more" ref={menu}>
          <summary className="queue-more-toggle" aria-label="More actions" title="More actions">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="16" cy="10" r="1.5" />
            </svg>
          </summary>
          <div className="queue-more-menu">
            {rest.map((action) => (
              <button
                key={action}
                type="button"
                className={actionCopy[action].destructive ? "is-destructive" : undefined}
                disabled={busy}
                onClick={() => run(action)}
              >
                <span>{label(action)}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** The step between asking for something irreversible and it happening. */
function ConfirmPanel({ post, state, action }: { post: ModeratedPost; state: QueueState; action: PostAction }) {
  const copy = actionCopy[action];
  return (
    <div className="queue-confirm" role="alertdialog" aria-label={copy.label}>
      <p>{copy.confirm}</p>
      <div className="actions">
        <button
          type="button"
          className={`btn btn-sm ${copy.destructive ? "btn-destructive" : "btn-primary"}`}
          onClick={() => void state.act(post, action)}
        >
          Yes, {copy.label.toLowerCase()}
        </button>
        <button type="button" className="btn btn-sm btn-secondary" onClick={state.cancel}>
          Keep it as it is
        </button>
      </div>
    </div>
  );
}

/** One memory as a row: who, what, when, where it stands, what can be done. */
function MemoryRow({ post, property, state, showProperty }: {
  post: ModeratedPost;
  property: HostProperty;
  state: QueueState;
  showProperty: boolean;
}) {
  const author = post.displayName?.trim() ?? "";
  const actions = availableActions(post);
  const blocked = actionsUnavailable(post);
  const hold = post.visibility === "visible" ? null : holdSummary(post);
  const confirming = state.confirming?.postId === post.id ? state.confirming.action : null;
  const result = state.result?.postId === post.id ? state.result : null;

  return (
    <tr className={`memory-row${post.visibility === "visible" && post.pinned ? " is-pinned" : ""}`}>
      {showProperty && <td className="cell-property" data-label="Property">{property.name}</td>}
      <td className="cell-from" data-label="From">{author || <span className="cell-quiet">Guest</span>}</td>
      <td className="cell-message" data-label="Memory">
        {post.photo && (
          <img
            className="cell-thumb"
            src={post.photo.url}
            alt={post.photo.alt || (author ? `Photograph left by ${author}` : "Guest memory photo")}
            loading="lazy"
            decoding="async"
          />
        )}
        {post.message ? <span>{post.message}</span> : <span className="cell-quiet">This memory&rsquo;s words have been removed.</span>}
      </td>
      <td className="cell-date" data-label="Posted">
        {post.createdAt ? <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time> : <span className="cell-quiet">&mdash;</span>}
      </td>
      <td className="cell-status" data-label="Status">
        <StateLabel post={post} always />
        {post.requiresScreenedReview && !blocked ? (
          <p className="queue-hold">Waiting in your Inbox.</p>
        ) : hold && <p className="queue-hold">{hold}</p>}
      </td>
      <td className="cell-actions" data-label="Actions">
        {blocked ? (
          <p className="field-hint">{blocked}</p>
        ) : confirming ? (
          <ConfirmPanel post={post} state={state} action={confirming} />
        ) : (
          <ActionButtons post={post} state={state} actions={actions} />
        )}
        {result && (
          <p className={`queue-result${result.failed ? " queue-result-failed" : ""}`} role={result.failed ? "alert" : "status"}>
            {result.message}
          </p>
        )}
      </td>
    </tr>
  );
}

type SortableKey = Exclude<MemorySortKey, "default">;

/** A column heading that sorts the table, and says which way it is sorted. */
function SortHeader({ label, column, sort, onSort }: {
  label: string;
  column: SortableKey;
  sort?: MemorySort;
  onSort?: (column: SortableKey) => void;
}) {
  if (!sort || !onSort) return <th scope="col">{label}</th>;
  const active = sort.key === column;
  return (
    <th scope="col" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" className={`sort-header${active ? " is-active" : ""}`} onClick={() => onSort(column)}>
        {label}
        <span className="sort-mark" aria-hidden="true">{active ? (sort.direction === "asc" ? "▲" : "▼") : "▴▾"}</span>
      </button>
    </th>
  );
}

function MemoryRows({ entries, stateFor, showProperty, label, sort, onSort }: {
  entries: FeedEntry[];
  stateFor: (property: HostProperty) => QueueState;
  showProperty: boolean;
  label: string;
  sort?: MemorySort;
  onSort?: (column: SortableKey) => void;
}) {
  return (
    <table className="inbox-table memory-table" aria-label={label}>
      <thead>
        <tr>
          {showProperty && <SortHeader label="Property" column="property" sort={sort} onSort={onSort} />}
          <SortHeader label="From" column="from" sort={sort} onSort={onSort} />
          <th scope="col">Memory</th>
          <SortHeader label="Posted" column="posted" sort={sort} onSort={onSort} />
          <SortHeader label="Status" column="status" sort={sort} onSort={onSort} />
          <th scope="col"><span className="visually-hidden">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {entries.map(({ post, property }) => (
          <MemoryRow key={`${property.id}/${post.id}`} post={post} property={property} state={stateFor(property)} showProperty={showProperty} />
        ))}
      </tbody>
    </table>
  );
}

/**
 * Memories from one wall or several, one row each.
 *
 * By default pinned memories lead, then the rest of the wall, then those taken
 * off it, each group newest first (see domain/memoryTable). Any column with a
 * sort control can take over the order, the filters narrow it by date and
 * state, and "Pinned first" puts the default back. Deleted memories have
 * nothing left to act on, so they fold away underneath.
 */
export function MemoryTable({ entries, deleted, stateFor, showProperty }: {
  entries: FeedEntry[];
  deleted: FeedEntry[];
  stateFor: (property: HostProperty) => QueueState;
  showProperty: boolean;
}) {
  const [sort, setSort] = useState<MemorySort>(defaultMemorySort);
  const [filter, setFilter] = useState<MemoryFilter>(defaultMemoryFilter);

  if (entries.length === 0 && deleted.length === 0) {
    return (
      <div className="queue-empty">
        <strong>No memories yet.</strong>
      </div>
    );
  }

  const rows = entries.map((entry) => ({ ...entry, propertyName: entry.property.name }));
  const shown = sortMemories(filterMemories(rows, filter), sort);
  const filtered = filter.range !== "all" || filter.status !== "all";

  return (
    <>
      {entries.length > 0 && (
        <div className="memory-controls">
          <label>
            <span>Status</span>
            <select value={filter.status} onChange={(event) => setFilter({ ...filter, status: event.target.value as StatusFilter })}>
              {(Object.keys(statusFilterLabels) as StatusFilter[]).map((key) => <option key={key} value={key}>{statusFilterLabels[key]}</option>)}
            </select>
          </label>
          <label>
            <span>Posted</span>
            <select value={filter.range} onChange={(event) => setFilter({ ...filter, range: event.target.value as DateRange })}>
              {(Object.keys(dateRangeLabels) as DateRange[]).map((key) => <option key={key} value={key}>{dateRangeLabels[key]}</option>)}
            </select>
          </label>
          {/* Phones draw rows as cards without column headings, so the sort
              is offered here instead; wider screens sort from the headings. */}
          <label className="memory-sort-select">
            <span>Sort by</span>
            <select
              value={`${sort.key}:${sort.direction}`}
              onChange={(event) => {
                const [key, direction] = event.target.value.split(":") as [MemorySortKey, MemorySort["direction"]];
                setSort({ key, direction });
              }}
            >
              <option value="default:asc">Pinned first</option>
              <option value="posted:desc">Newest first</option>
              <option value="posted:asc">Oldest first</option>
              <option value="status:asc">Status</option>
              <option value="from:asc">From (A to Z)</option>
              {showProperty && <option value="property:asc">Property (A to Z)</option>}
              {/* Keeps the select honest after a heading set a direction not listed above. */}
              {!["default:asc", "posted:desc", "posted:asc", "status:asc", "from:asc", "property:asc"].includes(`${sort.key}:${sort.direction}`) && (
                <option value={`${sort.key}:${sort.direction}`}>Custom</option>
              )}
            </select>
          </label>
          {filtered && <button type="button" className="btn btn-sm btn-secondary" onClick={() => setFilter(defaultMemoryFilter)}>Clear filters</button>}
          {sort.key !== "default" && (
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSort(defaultMemorySort)}>Pinned first</button>
          )}
          <p className="memory-controls-count" role="status">
            {shown.length === entries.length ? `${entries.length} ${entries.length === 1 ? "memory" : "memories"}` : `${shown.length} of ${entries.length} memories`}
          </p>
        </div>
      )}
      {entries.length > 0 && shown.length === 0 && (
        <div className="queue-empty"><strong>No memories match these filters.</strong></div>
      )}
      {shown.length > 0 && (
        <MemoryRows
          entries={shown}
          stateFor={stateFor}
          showProperty={showProperty}
          label="Memories"
          sort={sort}
          onSort={(column) => setSort((current) => nextSort(current, column))}
        />
      )}
      {deleted.length > 0 && (
        <details className="queue-section queue-removed">
          <summary>
            <svg className="queue-removed-mark" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.2 5.5l.8 11h8l.8-11" />
            </svg>
            <h3>Recently deleted <span className="queue-count">{deleted.length}</span></h3>
            <span className="queue-removed-view" aria-hidden="true">
              <span className="queue-removed-word" />
              <svg viewBox="0 0 20 20" focusable="false"><path d="m8 5 5 5-5 5" /></svg>
            </span>
          </summary>
          <MemoryRows entries={deleted} stateFor={stateFor} showProperty={showProperty} label="Recently deleted memories" />
        </details>
      )}
    </>
  );
}
