import { useEffect, useRef } from "react";
import {
  actionCopy,
  actionsUnavailable,
  availableActions,
  holdSla,
  holdSummary,
  primaryAction,
  queueSections,
  type ModeratedPost,
  type PostAction
} from "../../domain/postModeration";
import { formatDate, initials, toneIndex } from "../wall/demoWall";
import type { QueueState } from "./useModerationQueue";

/**
 * The wall, as the Host who owns it works through it.
 *
 * Every memory is drawn the way a guest would meet it — the photograph, the
 * message in the guest's own words, who wrote it — because a moderation
 * decision made from a truncated row in a table is a decision made blind. What
 * is added around it is only what a guest never sees: why it is off the wall,
 * how long is left on it, and what may be done about it.
 */

/**
 * What a memory's state is, in a pill. A memory that is simply on the wall
 * gets none: its section already says so, and a pill on every row of a long
 * wall is a label repeated until no one reads it.
 */
function StateLabel({ post }: { post: ModeratedPost }) {
  const sla = holdSla(post);
  const label =
    post.visibility === "visible" ? (post.pinned ? "Pinned" : null) :
    post.visibility === "hidden_pending_review" ? "Hidden, waiting on you" :
    post.visibility === "hidden_by_host" ? "Off the wall" :
    post.visibility === "restricted" ? "Held by DigiStayBook" :
    "Deleted";

  if (!label && !sla) return null;
  return (
    <p className="queue-state">
      {label && <span className={`state-pill visibility-${post.visibility}${post.pinned ? " is-pinned" : ""}`}>{label}</span>}
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
          className={`btn btn-sm ${
            actionCopy[lead].destructive ? "btn-destructive" : post.visibility === "visible" ? "btn-secondary" : "btn-primary"
          }`}
          // Only this memory's buttons go quiet while its own action is in
          // flight; the rest of the queue stays workable.
          disabled={busy}
          onClick={() => run(lead)}
        >
          {label(lead)}
        </button>
      )}
      {rest.length > 0 && (
        <details className="queue-more" ref={menu}>
          <summary className="btn btn-sm btn-ghost" aria-label="More actions">
            More <span aria-hidden="true">▾</span>
          </summary>
          <div className="queue-more-menu">
            {rest.map((action) => (
              <button
                key={action}
                type="button"
                className={actionCopy[action].destructive ? "is-destructive" : undefined}
                disabled={busy}
                aria-describedby={`${post.id}-${action}-hint`}
                onClick={() => run(action)}
              >
                <span>{label(action)}</span>
                <small id={`${post.id}-${action}-hint`} aria-hidden="true">{actionCopy[action].hint}</small>
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

function QueueCard({ post, state }: { post: ModeratedPost; state: QueueState }) {
  const author = post.displayName?.trim() ?? "";
  const actions = availableActions(post);
  const blocked = actionsUnavailable(post);
  const hold = post.visibility === "visible" ? null : holdSummary(post);
  const confirming = state.confirming?.postId === post.id ? state.confirming.action : null;
  const result = state.result?.postId === post.id ? state.result : null;

  return (
    <article className={`queue-note${post.visibility === "visible" && post.pinned ? " is-pinned" : ""}`}>
      {/* A row, not a card: once a wall has a season of memories on it a Host
          scans down a list, so the words sit on the left and what may be done
          about them lines up on the right. */}
      <div className="queue-note-body">
        {post.photo && (
          <div className="note-photo">
            <img
              src={post.photo.url}
              alt={post.photo.alt || (author ? `Photograph left by ${author}` : "Guest memory photo")}
              width={post.photo.width || undefined}
              height={post.photo.height || undefined}
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        {/* A deleted memory has had its words removed by the server, so the card
            says what it is rather than rendering an empty paragraph. */}
        {post.message ? (
          <p className="note-message">{post.message}</p>
        ) : (
          <p className="note-message note-empty">This memory&rsquo;s words have been removed.</p>
        )}

        <footer className="note-sign">
          {author && <span className={`avatar tone-${toneIndex(author)}`} aria-hidden="true">{initials(author)}</span>}
          <span className="note-author">
            {author && <b>{author}</b>}
            {post.createdAt && (
              <time dateTime={post.createdAt}>
                {post.stayedOn ? `Stayed ${post.stayedOn}` : `Posted ${formatDate(post.createdAt)}`}
              </time>
            )}
          </span>
        </footer>
      </div>

      <div className="queue-note-side">
        <StateLabel post={post} />
        {post.requiresScreenedReview && !blocked ? (
          <p className="queue-hold">Waiting on safety checks. <a className="text-link" href="#new-memories">Review it in New memories</a>.</p>
        ) : hold && <p className="queue-hold">{hold}</p>}

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
      </div>
    </article>
  );
}

export function ModerationQueue({ posts, state }: { posts: ModeratedPost[]; state: QueueState }) {
  const sections = queueSections(posts);

  if (sections.length === 0) {
    return (
      <div className="queue-empty">
        <strong>Nothing on this wall yet.</strong>
      </div>
    );
  }

  return (
    <>
      {sections.map((section) => {
        const heading = (
          <>
            {section.title} <span className="queue-count">{section.posts.length}</span>
          </>
        );
        const body = (
          <>
            <p className="queue-blurb">{section.blurb}</p>
            <div className="queue-grid">
              {section.posts.map((post) => (
                <QueueCard key={post.id} post={post} state={state} />
              ))}
            </div>
          </>
        );
        // Deleted memories have nothing left to act on, so they are folded
        // away rather than given the same weight as the live wall.
        return section.id === "removed" ? (
          <details className={`queue-section queue-${section.id}`} key={section.id}>
            <summary>
              <h3 id={`queue-${section.id}`}>{heading}</h3>
            </summary>
            {body}
          </details>
        ) : (
          <section className={`queue-section queue-${section.id}`} key={section.id} aria-labelledby={`queue-${section.id}`}>
            <h3 id={`queue-${section.id}`}>{heading}</h3>
            {body}
          </section>
        );
      })}
    </>
  );
}
