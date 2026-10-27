# Sharing with a server (optional)

Chronexus is complete on its own. With a **Chronexus Server** that you or your group host,
you can keep a campaign on several computers and share chosen items with your party.
How to install a server: see the
[server wiki](https://github.com/Acelith/Chronexus-Server/blob/main/docs/wiki/Home.md).

## Connect

**App settings → Campaign sharing**: enter the server's HTTPS address and press **Verify
and save server**, then sign in or create your account with an invitation code from the
server's operator. Your password goes only to that server and is never stored.

## Link a campaign

Open the campaign's **Sharing** view:

- **Create the shared campaign on the server** — you become its owner; or
- **Join with invitation** — paste a campaign invitation you received.

To download a campaign you already keep on the server (for example on a second
computer), use **App settings → Campaign sharing**.

## Choose what leaves this computer

Every page, session, relationship, party member, character-sheet section and image has
its own choice:

| Choice | Who sees it |
| --- | --- |
| Only on this device (default) | Nobody else |
| Private copy on the server | Only you, on your other computers |
| Shared with the other players | The campaign's members, read-only and attributed to you |

**Keep a private copy of everything** is a shortcut for the second option. Sheet sections
and images can only be shared, never copied privately. The full sheet, AI data and
preferences never leave your computer.

## Synchronizing

- **Synchronize now** sends and receives once.
- **Keep this campaign synchronized automatically** sends each save a moment later and
  receives others' changes as they happen. Editing never waits for the network. The
  status always says whether your change is *only on this device* or *also on the
  server*; offline changes wait and are sent when the server is back.
- **Shared with you** lists what others shared: read-only, with the author's name. It is
  their claim, never a fact of your campaign.

## Conflicts

If the same item changed here and on the server, **Conflicts** shows both versions side by
side. Choose which to keep; nothing is overwritten silently.

## Members and roles

| Role | Can |
| --- | --- |
| Owner | Invite, change roles, remove members, delete the campaign on the server |
| Player | Read what is shared and share own items |
| Reader | Only read |

In **Members**, press **Show the members** (the list is read from the server only when
you ask). The owner can switch a member between player and reader and **Remove from the
campaign**; others can **Leave the campaign**. A removed or departed member keeps
everything they wrote; what others shared is cleared from their computer at the next
synchronization, and what they shared is withdrawn. If your role becomes *reader*, your
own edits wait on your computer until you may write again.

## Stopping

- Changing an item back to *Only on this device* removes it from the server and from the
  others at their next synchronization; your copy stays.
- **Delete my copy on the server** removes everything you synchronized.
- **Unlink this campaign** forgets the sharing state on this computer only.
- The owner can **Delete the campaign on the server** (typing its name). Everyone keeps
  what is on their own computer.

> Data travels over HTTPS but is **not end-to-end encrypted**: the server's operator can
> read what you upload. Share only with a server you trust.
