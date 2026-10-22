# Contributing use cases

Anyone can add a use case to the Vibe Coding Workshop: a person, a company, a group of people, or a Databricks partner. A contribution is a folder of plain files in this repository, reviewed through a pull request and versioned with git. The app loads every contribution at startup, next to the use cases stored in its database.

Every contribution ships **switched off**. It appears in the Library (Configuration > Library) with its badges, and an admin turns on its Live switch before attendees see it in the workshop. Admins can switch contributions on and off and place them in collections, but they can't edit the content. Content only changes through pull requests here.

The fastest way to start is the sample: [`usecases/sample/contributed_usecase_starter/`](usecases/sample/contributed_usecase_starter/). It is a complete, working contribution with every field commented. It also appears in the app as "Sample: Field Service Scheduler" in the Partner & Community collection.

## Quick start

```bash
# 1. Register yourself once (types: partner, company, individual, group)
python scripts/contrib/new_contributor.py --id acme --type company --name "Acme Analytics" --github acme-org/solutions

# 2. Scaffold a use case from the sample
python scripts/contrib/new_usecase.py --contributor acme --slug claims_triage --title "Claims Triage Agent" --home retail

# 3. Edit contrib/usecases/acme/claims_triage/usecase.yaml and description.md, add images

# 4. Check it exactly the way the app loads it
python scripts/contrib/validate.py

# 5. Commit with a sign-off and open a pull request
git commit -s -m "Add Claims Triage Agent use case"
```

Add a line for your folder to [`.github/CODEOWNERS`](../.github/CODEOWNERS) in the same pull request, for example `/contrib/usecases/acme/  @prashsub @varunrao @acme-org/solutions`, so you're asked to review future changes to your use cases.

After the pull request is reviewed and merged, a maintainer must sync or deploy that commit to the Databricks App. In **Configuration > Library > Partner & Community**, choose **Reload deployed files** to re-read the `contrib/` directory without restarting the process. Reload does not pull from GitHub; a merged change cannot appear until its commit has been deployed.

## Folder layout

```
contrib/
  contributors/<id>/contributor.yaml        who you are (maintainers review every change)
  contributors/<id>/avatar.png              optional logo or photo
  usecases/<id>/<slug>/usecase.yaml         metadata, placement, version, changelog
  usecases/<id>/<slug>/description.md       the brief attendees build from
  usecases/<id>/<slug>/images/              optional cover and screenshots
  certifications/<certifier>/<id>__<slug>.yaml
  schema/                                   generated JSON schemas for editor validation
```

The app identifies a use case as `contrib__<id>__<slug>`. Both ids are permanent: renaming or deleting a folder breaks workshop sessions that already use it, so the validator blocks it. To retire a use case, set `status: withdrawn`. It disappears from listings, and existing sessions keep working.

## Who you are: contributor types

| Type | Shown as | Example |
| --- | --- | --- |
| `partner` | Partner badge | A Databricks consulting or technology partner |
| `company` | Third-party badge | A customer or any other organization |
| `individual` | Third-party badge | One person |
| `group` | Third-party badge | A team, community or several people (list them under `members`) |

```yaml
# contrib/contributors/data_guild/contributor.yaml
schema_version: 1
id: data_guild
type: group
display_name: "Data Guild"
github: data-guild
members:
  - name: Ana Silva
    github: anasilva
  - name: Raj Patel
can_certify: false
```

Several contributors can share credit for one use case through `co_contributors: [jane_doe]`, as long as each is registered.

## Writing the brief (description.md)

`description.md` is what the workshop sends to the coding assistant, so write it as a build brief: what to build, the core features, the data, and what good looks like. Keep it under 20,000 characters. The loader rejects briefs that would be unsafe to hand to an AI assistant:

- commands that pipe a download into a shell (`curl ... | sh`)
- secrets, tokens or private keys
- text that tries to override the assistant's instructions
- links that aren't https, or `javascript:` and `data:` links
- hidden Unicode characters, raw HTML outside code blocks, and embedded images

Commands such as `rm -rf` or `sudo` produce a warning rather than an error.

## Optional featured resource

A use case can feature one recording, Google Doc/Sheet/Slides file, or other HTTPS resource without making it required:

```yaml
featured_resource:
  label: Watch the demo
  url: https://www.youtube.com/watch?v=MUa5kbIV1Lc
```

YouTube links receive a thumbnail automatically. Other links render as a compact provider card. The sample contribution includes the workshop walkthrough so you can preview the treatment in the app.

## Versions and updates

Use semantic versions. Every change to a use case folder needs a higher `version` and a matching `changelog` entry; the pull-request check enforces this. Git keeps the full history of every file.

## Certification

A certification says that a trusted contributor ran the use case end to end and stands behind it. Only contributors with `can_certify: true` can certify, and only maintainers can grant that flag. To certify, a certifier adds:

```yaml
# contrib/certifications/acme/data_guild__claims_triage.yaml
schema_version: 1
version: 1.0.0          # the exact version you validated
date: 2026-10-20
notes: Ran the full workshop flow on a fresh workspace; the generated app deploys and passes its tests.
evidence_url: https://github.com/acme-org/evidence/pull/12   # optional
```

The app shows a "Certified by Acme" badge only while the certified version equals the use case's current version, so a new version needs a fresh certification. This is separate from the gold Certified seal, which admins grant to native use cases in the Library.

## How it shows up in the app

- **Badges** on every card: Native, Partner or Third-party with the contributor's name, Certified by, Sample and Deprecated.
- **Placement**: in the `home` collection (if this install has it), in any `also` collections, and always in Partner & Community.
- **Supporting resource** above the description when `featured_resource` is present, using the same restrained card as native use cases.
- **Details panel** under the description: contributor, certifications, version history, screenshots and additional links.
- **Filter** in the workshop picker (All, Native, Partner, Third-party, Certified) whenever a collection has contributions.
- **MCP**: use-case listings include `provenance`, `contributed_by` and `certified_by`.

## Checks

The pull-request workflow runs `scripts/contrib/validate.py --base origin/main`, checks that the generated schemas are current, runs `tests/contrib`, and requires a `Signed-off-by` line on every commit ([Developer Certificate of Origin](https://developercertificate.org/)). A broken contribution never takes the app down: the loader skips just that entry and logs why. Admins can see skipped entries at `/api/contrib/status`.
