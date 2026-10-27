import { useState } from "react";
import { tr } from "../../i18n/store";
import { syncApi, type SyncLink, type SyncMember } from "./api";
import { roleText } from "./labels";

/**
 * Members of a shared campaign. The list is read from the server only when asked; the
 * owner changes roles and removes members, the others can leave. Every removal is
 * confirmed first.
 */
export default function CampaignMembers({
  campaignId,
  link,
  disabled,
  act,
  onLink,
}: {
  campaignId: string;
  link: SyncLink;
  disabled: boolean;
  act: (action: () => Promise<string | void>) => Promise<void> | void;
  onLink: (link: SyncLink) => void;
}) {
  const [members, setMembers] = useState<SyncMember[] | null>(null);
  const [removing, setRemoving] = useState<SyncMember | null>(null);
  const [leaving, setLeaving] = useState(false);
  const owner = link.role === "owner";
  return (
    <section aria-label={tr("Members")}>
      <h4>{tr("Members")}</h4>
      <button
        disabled={disabled || link.accessLost}
        onClick={() =>
          void act(async () => {
            setMembers(await syncApi.members(campaignId));
          })
        }
      >
        {members ? tr("Reload the members") : tr("Show the members")}
      </button>
      {members ? (
        <ul className="sync-members">
          {members.map((member) => {
            const self = member.accountId === link.accountId;
            return (
              <li key={member.accountId}>
                <span dir="auto">{member.displayName}</span>
                {" · "}
                {owner && member.role !== "owner" ? (
                  <select
                    aria-label={tr("Role of {0}", [member.displayName])}
                    value={member.role}
                    disabled={disabled}
                    onChange={(event) => {
                      const role = event.target.value as "player" | "reader";
                      void act(async () => {
                        setMembers(
                          await syncApi.changeMember(
                            campaignId,
                            member.accountId,
                            role,
                            member.revision,
                          ),
                        );
                        return tr("Role changed.");
                      });
                    }}
                  >
                    {(["player", "reader"] as const).map((role) => (
                      <option key={role} value={role}>
                        {roleText(role)}
                      </option>
                    ))}
                  </select>
                ) : (
                  roleText(member.role)
                )}
                {self ? ` · ${tr("you")}` : null}
                {owner && member.role !== "owner" ? (
                  <>
                    {" "}
                    <button
                      disabled={disabled}
                      onClick={() => setRemoving(member)}
                    >
                      {tr("Remove from the campaign")}
                    </button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {!owner && !link.accessLost ? (
        <button disabled={disabled} onClick={() => setLeaving(true)}>
          {tr("Leave the campaign")}
        </button>
      ) : null}
      {removing ? (
        <div role="alertdialog" aria-label={tr("Remove from the campaign")}>
          <p>
            {tr(
              "Remove {0} from the campaign? Their devices clear what the other players shared at their next synchronization, and the items they shared are withdrawn for everyone. They keep everything on their own computer.",
              [removing.displayName],
            )}
          </p>
          <button
            className="primary"
            disabled={disabled}
            onClick={() =>
              void act(async () => {
                const name = removing.displayName;
                setMembers(
                  await syncApi.removeMember(
                    campaignId,
                    removing.accountId,
                    removing.revision,
                  ),
                );
                setRemoving(null);
                return tr("{0} was removed from the campaign.", [name]);
              })
            }
          >
            {tr("Remove")}
          </button>
          <button disabled={disabled} onClick={() => setRemoving(null)}>
            {tr("Cancel")}
          </button>
        </div>
      ) : null}
      {leaving ? (
        <div role="alertdialog" aria-label={tr("Leave the campaign")}>
          <p>
            {tr(
              "Leave this shared campaign? What the other players shared is cleared from this device and the items you shared are withdrawn. Everything you wrote stays on this device. You can join again only with a new invitation.",
            )}
          </p>
          <button
            className="primary"
            disabled={disabled}
            onClick={() =>
              void act(async () => {
                onLink(await syncApi.leave(campaignId));
                setLeaving(false);
                setMembers(null);
                return tr(
                  "You left the shared campaign. Your items are still on this device.",
                );
              })
            }
          >
            {tr("Leave")}
          </button>
          <button disabled={disabled} onClick={() => setLeaving(false)}>
            {tr("Cancel")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
