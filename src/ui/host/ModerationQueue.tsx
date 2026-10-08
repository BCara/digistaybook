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

function StateLabel({ post }: { post: ModeratedPost }) {
  const sla = holdSla(post);
  const label =
    post.visibility === "visible" ? (post.pinned ? "Pinned to the top" : "On the wall") :
    post.visibility === "hidden_pending_review" ? "Hidden, waiting on you" :
    post.visibility === "hidden_by_host" ? "Off the wall" :
    post.visibility === "restricted" ? "Held by DigiStayBook" :
    "Deleted";

  return (
    <p className="queue-state">
      <span className={`state-pill visibility-${post.visibility}${post.pinned ? " is-pinned" : ""}`}>{label}</span>
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
  const busy = state.working?.postId === post.id;

  return (
    <>
      <div className="queue-actions">
        {actions.map((action) => {
          const copy = actionCopy[action];
          const inFlight = busy && state.working?.action === action;
          return (
            <button
              key={action}
              type="button"
              className={`btn btn-sm ${action === lead && !copy.destructive ? "btn-primary" : "btn-secondary"}${
                copy.destructive ? " btn-destructive" : ""
              }`}
              // Only this memory's buttons go quiet while its own action is in
              // flight; the rest of the queue stays workable.
              disabled={busy}
              onClick={() => (copy.confirm ? state.ask(post, action) : void state.act(post, action))}
            >
              {inFlight ? "Working…" : copy.label}
            </button>
          );
        })}
      </div>
      {/* What the recommended action does, in a line. It is written out rather
          than hung on a `title` tooltip, which no one reads on a phone — and a
          phone is where a Host clears their queue between changeovers. */}
      {lead && <p className="queue-lead-hint">{actionCopy[lead].hint}</p>}
    </>
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
    <article className="queue-note">
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

      <StateLabel post={post} />
      {post.requiresScreenedReview && !blocked ? (
        <p className="queue-hold">This new submission needs safety checks and host review. <a className="text-link" href="#new-memories">Review in New memories above</a>.</p>
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
      {sections.map((section) => (
        <section className={`queue-section queue-${section.id}`} key={section.id} aria-labelledby={`queue-${section.id}`}>
          <h3 id={`queue-${section.id}`}>
            {section.id === "review" ? "Off the wall" : section.title} <span className="queue-count">{section.posts.length}</span>
          </h3>
          <p className="queue-blurb">{section.id === "review" ? "Hidden memories and their status. Review new submissions in New memories above." : section.blurb}</p>
          <div className="queue-grid">
            {section.posts.map((post) => (
              <QueueCard key={post.id} post={post} state={state} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
