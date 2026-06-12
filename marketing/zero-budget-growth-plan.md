# Vacationist — Zero-Budget Growth Plan
*Constraints: €0 budget · 1 founder · minimal existing audience · no team · no paid ads*

---

## The Honest Preamble

Most "growth guides" are written for funded startups. This one is not.

At zero budget, you have exactly three assets:
1. **Time** (finite — probably 10–20 hours/week if building in parallel)
2. **The product itself** (which spreads when people invite others)
3. **Your authentic story** (nobody else can tell it)

Everything in this plan uses one or more of those three assets. If an action requires money, it's not in this plan. If an action requires a team, it's not in this plan. If an action depends on luck rather than repeatable execution, it's flagged clearly.

**Realistic timelines:**
- 250 users: 4–8 weeks with focused effort
- 500 users: 2–4 months
- 1,000 users: 4–6 months
- 2,500 users: 8–12 months
- 10,000 users: 14–24 months (without iOS or a viral moment: 24+ months)

The single biggest unlock is iOS. Every other milestone gets 30–50% easier the moment iOS ships. Treat it as a growth investment, not a technical task.

---

## Before Anything: The 3 Things to Fix This Week

These aren't growth actions. They are minimum viable prerequisites. Nothing else in this plan works as well without them.

### Fix 1 — Loosen the Free Tier
Change the annual day limit from 15 → 30 days. Right now, someone planning a 10-day trip burns 67% of their year's quota on trip #1. That person has no room to recommend the app to someone else who then creates their own trip. Every extra free day is a growth multiplier, not a revenue loss — you have no revenue yet.

### Fix 2 — Update the Play Store
- App name: "Vacationist — Group Trip Planner" (replaces "Plan Trips Together")
- Screenshots: take real device screenshots today, replace the HTML mockups
- Short description: "Vote on activities, split expenses, sync in real time"

### Fix 3 — Set Up Basic Analytics
Install PostHog (free tier). You need to know: where users come from, where they drop off, how many complete their first invite. Without this, you're flying blind through everything that follows.

---

## THE ACTIONS

---

## Action 1: Personal Network Activation

**Effort:** Medium (2–3 hours of deliberate writing + sending)
**Cost:** €0
**Expected outcome:** 30–60 installs, 5–15 real trip creations, first 3–5 Play Store reviews

### Why It Works
This is the only channel where conversion is near-certainty. A generic email blast to "your network" gets 2–5% response. A personally written message to 50–80 specific people gets 30–60% response. The difference is personalization and the social obligation between people who know each other.

People who try the app because you asked them personally are also more likely to share it with their own groups because they want you to succeed. They are your first growth agents.

This is not scalable. That's fine. It doesn't need to be. You need 30–60 installs, not 30,000.

### Example Execution

Do NOT send a group message. Do NOT send a newsletter. Send individual messages.

Write a template that you genuinely customize per person:

> "Hey [Name], I've been building something for the past 6 months and I just shipped it. It's a group trip planning app — basically Splitwise + activity voting in one. I'd love for you to try it, especially since [you always organize the ski trips / you and your partner travel a lot / you complained about the Croatia trip chaos last year]. Here's the Play Store link: [link]. If you use it for your next trip, even a short one, I'd be incredibly grateful. Honest feedback welcome."

**Target list structure:**
- 15 friends who organize group trips or travel regularly
- 10 people from work/uni who travel with others
- 10 people who use Splitwise (they already understand expense splitting)
- 10 family members or family-adjacent people
- 5–10 people who specifically complained about a chaotic group trip recently

After they install: message them again personally 3 days later: "Did you get a chance to try it? Anything confusing?" This closes the loop and gets feedback, and often prompts them to actually use it.

After they use it: ask specifically for a Play Store review. "Would you mind leaving a review? Even one sentence. It's the #1 thing that helps new apps get found." Most people who've genuinely used the app will say yes if you ask directly.

**Don't skip this.** It feels slow and unscalable, but your first 25 reviews and your first wave of real trip data comes from here. Every other growth channel is easier with 25 reviews behind you.

---

## Action 2: The Invite Page Conversion Upgrade

**Effort:** Low (2–4 hours of HTML/CSS work on `docs/join.html`)
**Cost:** €0
**Expected outcome:** 15–30% improvement in guest-to-signup conversion; compounds with every trip created

### Why It Works
Right now, every time someone creates a trip and invites their friends, those friends land on a join page. This is happening whether you market or not. Each invite is a free marketing impression to a cold audience — someone who has never heard of Vacationist.

The current join page is functional but not persuasive. It probably says something like "Join [trip name]" and shows a button. It should be the best 30-second pitch for the product.

If you have 10 active users each inviting an average of 5 people per trip, that's 50 new people seeing your app every trip cycle. If 20% convert to installing the app (even just to view the trip), that's 10 new users per trip cycle from zero effort. That number compounds as your user base grows.

### Example Execution

Rebuild `docs/join.html` (the invite landing page) to include:

1. **Trip name prominently**: "[Friend's name] invited you to plan [Trip Name] together"
2. **Social proof mechanic**: "3 members have already joined"
3. **What they'll see when they join**: 3 quick screenshots of the voting screen, the expense split, the shopping list
4. **Two-second feature list**: "Vote on activities · Split costs · Real-time sync · No account required"
5. **Big, clear CTA**: "Join the trip — it's free"
6. **Below the fold**: "Want to plan your own trip? Vacationist is free to download" → Play Store link

The emotional framing matters: make them feel like they're missing a shared experience if they don't click. "Your group is already planning. Join them."

This one change costs 3 hours and pays dividends on every future invite sent. Do it before week 2.

---

## Action 3: Reddit — Value-First Strategy

**Effort:** High (consistent, weekly, requires genuine participation)
**Cost:** €0
**Expected outcome:** 2–5 good posts = 200–600 installs over 3–4 months if executed well; one breakout post = 200–500 installs in 48 hours

### Why It Works
Reddit is the highest-trust, highest-conversion discovery channel for apps at zero budget. A recommendation on Reddit carries the weight of a peer review, not an ad. Travel subreddits have millions of monthly visitors actively looking for solutions to exactly the problems Vacationist solves.

The catch: Reddit despises overt marketing. You will be banned or downvoted into invisibility if your first post is "I made this app, please use it." The strategy is to become a genuine community member first, then let the app emerge naturally from that credibility.

One good Reddit post that hits the front page of r/travel (16M members) can drive 300–1,000 app installs in 48 hours. You only need this to happen once or twice to hit 500 users.

### Example Execution

**Phase 1: Build karma and credibility (weeks 1–4)**

Post genuine, helpful content in these subreddits with NO promotion:
- r/travel — trip reports, destination advice, coordination tips
- r/solotravel — "I'm usually solo but did a group trip" content
- r/shoestring — budget-focused group travel advice
- r/digitalnomad — coordination content for nomads
- r/camping / r/hiking — group logistics content

Target: 10 helpful comments or posts that get at least +20 upvotes. This takes 2–3 weeks.

**Phase 2: Soft introduction (weeks 4–6)**

Post a "problem awareness" post that sets up the context without mentioning the app:

Example post for r/travel:
> **Title: "How do you actually coordinate group trips? Genuine question."**
> 
> "We just got back from a 9-day trip with 8 people. We used: WhatsApp for everything, a Google Doc that half the group never opened, Splitwise for expenses (which 3 people refused to install), and someone's notes app for addresses. It was fine but completely chaotic. I'm genuinely curious — how do you all coordinate group trips? Is there a system that actually works? What do you use?"

This post generates real discussion. Other users mention the same pain. You participate in the thread genuinely. Eventually someone asks "did you find a solution?" — that's when you mention the app naturally.

**Phase 3: Show don't tell (weeks 6–12)**

Post a case study, not a pitch:

> **Title: "How we coordinated a 10-person trip to Greece — breakdown of what worked and what didn't"**
>
> [Long-form post about the actual trip. Real destinations, real logistics, real problems. Mention every tool used. Vacationist is one of them, not the hero — it's the solution to the WhatsApp chaos they described. Screenshots of the voting results, the expense split. No download link in the post body — let it come up in comments.]

If this post gets +200 upvotes on r/travel, expect 100–300 genuine app installs.

**The golden rule:** Never post a link to the Play Store in the post body of your first mention. Put it in a comment. Never use a sentence like "I built this app." Use "we've been using this app." The community distinguishes promoters from users.

---

## Action 4: TikTok Content Engine

**Effort:** High (3 videos/week, 2–3 hours/week ongoing)
**Cost:** €0
**Expected outcome:** 0–50 installs/month for first 6–8 weeks; 100–1,000+/month after a breakout video

### Why It Works
TikTok's algorithm is the most democratic distribution system that exists. A brand-new account with 0 followers can get 100,000 views on its first video if the content is good. No other platform offers this.

The content format that works for an app like Vacationist is "relatable problem → clean solution." The app's dark UI, the vote reveal animation, the real-time sync — these are all visually compelling in a way that many apps are not.

The catch: TikTok takes time to compound. You will likely post 10–15 videos before one breaks out. The failure mode is posting 3 videos, getting 200 views each, giving up. The success case is posting consistently for 8 weeks until one video hits.

The phone + screen recording format (showing the app while narrating) is the lowest-effort format and works well for utility apps.

### Example Execution

**Account setup:**
- @vacationist.app or @planwithvacationist
- Bio: "The group trip app that replaced WhatsApp polls. Free on Android."
- Profile picture: the app icon

**Video formats that work (prioritized):**

**Format 1 — "The reveal"** (highest viral potential)
Hook: "Nobody talks about why group trips actually fail"
Content: 3 frames — (1) show the WhatsApp chaos (fake convo screenshot), (2) "vs. this" pivot, (3) show the voting screen with the reveal animation
CTA: "Link in bio for Android. iOS coming soon."
Runtime: 30–45 seconds

**Format 2 — "Watch me plan X in Y minutes"**
Hook: "Planning an 8-person trip to Barcelona in 3 minutes"
Content: Real screen recording of creating a trip, adding activities, inviting people
No narration needed — on-screen text works
CTA: "Try it free — link in bio"
Runtime: 60–90 seconds

**Format 3 — "The vote reveal"**
Hook: "POV: your friend group finally agreeing on something"
Content: Show a group vote where one option gets all "must_do" votes. Slow reveal. Play reaction audio.
CTA: None needed — the visual does the work. Comments drive interest.
Runtime: 15–30 seconds

**Format 4 — "Relatable chaos → solution"**
Hook: "Every group trip WhatsApp looks like this" + fake chaotic screenshot
Content: "Here's what ours looks like now" + clean Vacationist UI
Runtime: 20–30 seconds

**Posting rhythm:** 3 per week, same 3 days each week (e.g., Monday, Wednesday, Friday). Consistency matters more than production quality. Phone camera + screen recording is completely sufficient.

**Do not:** Over-produce. Don't buy a ring light and write scripts. The authentic "I built this and here's how it works" tone outperforms polished ads on TikTok.

---

## Action 5: The "Why I Built This" LinkedIn Post

**Effort:** Low (1–2 hours to write, once)
**Cost:** €0
**Expected outcome:** 50–200 installs; potential to be shared by others; builds founder credibility

### Why It Works
LinkedIn's algorithm strongly favors personal stories with genuine vulnerability. The "I built this because I experienced this pain" format consistently outperforms product announcements. People share authentic founder stories.

Your target audience on LinkedIn — professionals aged 25–40 who travel with friends or organize work events — is exactly who Vacationist is for.

This is a one-time post, not a content engine. But one good LinkedIn post from a genuine founder story can reach 5,000–50,000 people organically if the engagement is strong in the first 30 minutes.

### Example Execution

Write this post. Not a template — your version of it. The specific details are what make it work.

Structure:
- Line 1 (hook): A single sentence that captures the pain. "I've planned 11 group trips. Every single one was coordinated through WhatsApp chaos."
- Lines 2–5: The specific moment the problem became unbearable. A real story — the Croatia trip that fell apart, the Splitwise fight, the Google Doc nobody read.
- Lines 6–8: What you tried. Notion. Splitwise. Travel apps. None of them solved the actual problem.
- Lines 9–12: What you built and why. One sentence on each core feature. Not a feature list — why each feature exists.
- Line 13: The honest ask. "It's free. If you've ever organized a group trip, I'd genuinely love to know if it solves the problem."
- Lines 14–15: "Play Store link in comments. iOS coming soon."

**Post the Play Store link in the first comment, not in the post body** — LinkedIn's algorithm suppresses posts with external links. Post the link as a comment 5 minutes after you post.

**Timing:** Post on Tuesday, Wednesday, or Thursday morning between 7–9am in your timezone. Engage with every comment in the first 2 hours — this feeds the algorithm.

**What to expect:** If this post gets 30+ reactions in the first hour, it's going to compound. If it gets fewer than 10, it probably won't spread. Don't repost the same content. Write a different angle 3–4 weeks later.

---

## Action 6: Micro-Influencer Outreach (Barter, Not Payment)

**Effort:** Medium (4–6 hours total: research + writing + follow-up)
**Cost:** €0 (barter: free Pro subscription)
**Expected outcome:** 1–3 genuine video reviews = 100–800 installs per review (depending on audience size and engagement)

### Why It Works
You cannot afford paid influencer deals. But free app access is a real barter. A travel creator with 10,000–50,000 followers who genuinely uses your app and tells their audience about it is worth more than 50,000 impressions from a paid post, because the trust transfer is real.

The key is targeting creators whose audience exactly matches the product. A travel creator whose content is specifically about "planning trips with friends" or "group travel coordination" has an audience that will care about this app.

### Example Execution

**Identify targets:**
Search Instagram and TikTok for:
- "group trip planning" + travel accounts
- "bachelorette trip" creators
- "budget travel with friends" accounts
- German-language travel creators (especially relevant for DACH market)
- Hiking/camping group content creators

Look for: 5,000–80,000 followers, good engagement rate (3%+ is healthy), content that's specifically about group coordination or group travel logistics — not just beautiful destination photos.

Target 15–20 creators with a genuine, personalized message. Expect 2–4 to respond positively.

**The outreach message (DM or email):**

> "Hey [Name] — I've been following your content for a while. Your [specific recent post about planning the Lisbon trip with your crew] is exactly the kind of content that made me think of you.
>
> I built a group trip planning app called Vacationist — basically Splitwise + activity voting in one app. I think your audience would genuinely find it useful based on how you plan trips together.
>
> I'm not asking you to promote anything. I'd love to give you free access to the Pro version, let you and your travel group actually use it for a real trip, and if you think it's worth sharing with your audience, I'd be grateful. If not, no pressure — keep the Pro access either way.
>
> Would you be open to trying it?"

**What you're looking for:** A creator who actually plans group trips and has experienced the WhatsApp chaos you're solving. If they use it on a real trip, an authentic review follows naturally.

**Don't target:** Mega influencers (impossible to get attention), creators who only post destination photography (wrong audience), creators who clearly do paid promotions without disclosure (wrong ethics).

---

## Action 7: One SEO Article That Ranks

**Effort:** High (8–12 hours to write well)
**Cost:** €0
**Expected outcome:** 0 installs for first 3 months; then 50–300 organic installs/month passively, forever

### Why It Works
This is the one channel with compounding, passive returns. A well-written "Splitwise alternative for travel" article that ranks on page 1 of Google drives installs every day without any ongoing effort. It takes 3–6 months to rank, so starting this in week 1 means it's paying off by month 4.

You only need one article to rank well to see meaningful results. But it must be the right article.

**The target article:** "Best Splitwise Alternatives for Group Travel in 2026"

Why this specific article:
- "Splitwise alternative" gets 8,000–15,000 searches/month
- Searchers are already product-aware (they know expense splitting) and want more
- Vacationist directly answers their need (expenses + trip planning)
- The article can rank without backlinks if it's genuinely the most comprehensive answer to the query

### Example Execution

**Structure of the article:**
- Title: "7 Best Splitwise Alternatives for Group Travel in [Year]"
- Length: 2,500–4,000 words
- Format: genuine comparison, not a puff piece
- Cover: Splitwise itself (acknowledge it), then list 6 real alternatives, with Vacationist as option #1 for travelers specifically
- Be honest about what each app does well. Ranking sites that are obviously biased don't rank.

**What the Vacationist section should say:**
- Best for: Group travelers who need more than expense splitting
- What it adds over Splitwise: voting, accommodation management, shopping lists, shared calendar, offline support
- What it lacks vs. Splitwise: smaller user base, currently Android-only (be honest)
- Free tier: generous enough for most trips
- Unique: the "group_blocker" vote — no other app has this

**Publish at:** vacationist.app/blog/splitwise-alternatives (build the blog first — even a simple /blog directory with clean HTML)

**Second article to write (concurrently or next):** "Best Wanderlog Alternatives That Actually Do Expense Splitting" — similar structure, targets wanderlog alternative keyword cluster.

---

## Action 8: Play Store Review Campaign

**Effort:** Low (1–2 hours)
**Cost:** €0
**Expected outcome:** 15–25 reviews; measurable improvement in install-to-retention conversion

### Why It Works
Below 25 reviews, a significant percentage of potential users dismiss the app as too new or unproven. This is one of the most irrational but consistent behaviors in app store psychology. Getting past 25 reviews is a threshold, not a gradient — the drop in skepticism is disproportionate to the number of reviews.

You cannot buy reviews. You cannot use review exchange services (against Play Store policies). You must ask real users directly.

### Example Execution

After a user has created their first trip AND invited at least one person (meaning they've had a real experience), trigger this sequence:

1. **In-app prompt (non-intrusive):** After a user completes their first vote or expense split, show a bottom sheet: "Enjoying Vacationist? It takes 30 seconds to leave a rating — it means a lot to an indie app." With a "Leave a review" and "Maybe later" button. The timing matters: after a successful moment, not at random.

2. **Direct personal ask:** For the first 30 users you onboarded personally, message them: "One more ask — would you leave a quick Play Store review? Even one sentence genuinely helps. Here's the link: [link]."

3. **For micro-influencer reviewers:** Ask them specifically to leave a Play Store review as part of the arrangement.

**Target:** 25 reviews within the first 6 weeks. Quality matters — a review that mentions a specific feature ("loved the voting reveal") is more valuable than "great app."

---

## Action 9: German-Language Community Seeding

**Effort:** Medium (same as Reddit strategy, different platform)
**Cost:** €0
**Expected outcome:** 50–200 additional installs from DACH market over 3 months

### Why It Works
The app already has full German i18n. The DACH market (Germany, Austria, Switzerland) is one of the highest-travel-frequency markets in Europe. German-language Splitwise competitors are weak. The privacy angle (encrypted documents, no data monetization) resonates strongly with German users.

And critically: the German-language travel app ecosystem is far less crowded than English. Competition for a r/Reisen post is a fraction of the competition for a r/travel post.

### Example Execution

**Platforms:**

- **Reddit**: r/de (1.3M), r/Reisen (group travel discussions), r/Urlaub
- **German Facebook Groups**: "Gruppenreisen" groups, university student groups, hiking club groups
- **XING**: German LinkedIn equivalent — especially for the professional/sports team angle

**Same value-first approach as the English Reddit strategy.** Post in German. Write like a German speaker, not like a translated English post. Specific, practical, no buzzwords.

Example post for r/Reisen:
> "Wie organisiert ihr Gruppenreisen? Wir haben gerade einen 9-Tage-Trip mit 8 Leuten hinter uns und ich bin noch nie so froh gewesen, wenn ein WhatsApp-Chat endlich zur Ruhe kommt..."

Build credibility for 2–3 weeks before mentioning the app.

---

## Action 10: The "Organizer Burnout" Content Piece

**Effort:** Medium (3–5 hours to write a long-form piece)
**Cost:** €0
**Expected outcome:** Evergreen content that ranks, gets shared, and positions Vacationist emotionally

### Why It Works
Every single person who has ever organized a group trip has felt this. The burden is real, universal, and emotionally intense. Nobody in the travel app space is speaking directly to the person who plans everything for everyone else.

This content isn't a product pitch — it's a mirror. People share things that make them feel seen. If this piece resonates, it gets shared organically across WhatsApp groups, Facebook, and Reddit, every time by a group organizer who tags the people they plan trips for.

### Example Execution

Long-form post / article: **"Nobody talks about organizer burnout on group trips"**

Structure:
- The invisible labor of being "the one who plans everything"
- The emotional cost (always responsible, rarely appreciated, bears all blame when things go wrong)
- The specific moments that break you (the Google Doc nobody reads, the Splitwise user who refuses to install it, the WhatsApp poll that takes 4 days to get 8 responses)
- What you wish existed (answer: exactly what Vacationist does — distribute the cognitive load)
- Closing: a genuine pitch for Vacationist as a tool, not just an app

Publish on:
- The Vacationist blog (SEO value)
- Submitted to r/travel as a discussion post (not linked from blog — write it as a Reddit post natively)
- LinkedIn as a long-form article
- Medium (for discoverability)

This piece should make the trip organizer feel seen before they ever know what Vacationist is. If the product is good, the download happens naturally after that.

---

## THE MILESTONES

---

## Path to 250 Users

**Primary channels:** Personal network + Play Store reviews + first Reddit presence + invite mechanic
**Timeline:** 4–8 weeks with focused effort

At this stage, you are not building a machine. You are doing things that don't scale. That's correct. Every download at this stage is a relationship.

| Action | Users from this action | Cumulative |
|--------|----------------------|------------|
| Personal network outreach (80 people) | 40–60 | 40–60 |
| Friends invite their groups (organic invite mechanic) | 20–40 | 60–100 |
| First 2 Reddit posts (genuine) | 30–80 | 90–180 |
| LinkedIn "why I built this" post | 30–80 | 120–260 |
| Invite page improvement (conversion lift on existing invites) | 15–30 | 135–290 |
| Play Store discovery (improved ASO + first reviews) | 20–50 | 155–340 |

**What you need to do:**
1. Message 80 people personally. Not mass email — individual messages.
2. Ask 20 of the responders specifically for Play Store reviews.
3. Post the "why I built this" story on LinkedIn.
4. Post 2 genuine, non-promotional posts in r/travel or r/solotravel.
5. Rebuild the invite page to be a marketing moment.
6. Update ASO (app name + keywords + screenshots) this week.

**What success looks like at 250:** At least 10 people have created trips and invited at least 5 others. The invite loop is turning. You have 15+ Play Store reviews. You have PostHog set up and can see where users drop off.

---

## Path to 500 Users

**Primary channels:** Reddit momentum + TikTok starting to compound + first SEO traffic + invite loop
**Timeline:** 2–4 months from zero

At 500 users, the invite mechanic starts doing real work. If your average trip has 4–6 members, and you have 100 trips created, that's 400–600 potential new users exposed through invites alone.

| Action | Users from this action | Cumulative |
|--------|----------------------|------------|
| 250 base (from above) | — | 250 |
| Reddit: 4–6 posts + active community participation | 60–150 | 310–400 |
| TikTok: first 20 videos (8–10 weeks) | 30–100 | 340–500 |
| First SEO article starts indexing (partial) | 10–30 | 350–530 |
| Micro-influencer: 2 collaborations | 50–150 | 400–680 |
| German community seeding (r/Reisen, Facebook) | 30–80 | 430–760 |
| Invite mechanic compounding | 50–100 | 480–860 |

**The honest admission:** Hitting 500 users in 2 months without a viral moment is hard. It requires consistent execution across 3–4 channels simultaneously. If the LinkedIn post or a Reddit post breaks out (+500 upvotes), 500 users becomes achievable in 4–6 weeks. Without a breakout moment, it's more like 3–4 months.

**What you need to do:**
1. Post consistently on TikTok (3 videos/week, minimum 8 weeks before evaluating).
2. Be genuinely active on Reddit (2–3 posts/week, value-first).
3. Publish the first SEO article.
4. Execute micro-influencer outreach (20 DMs, expect 2–3 positive responses).
5. Start German-language community seeding.

**What success looks like at 500:** At least 3–5 users have created more than one trip. The invite loop is clearly working in PostHog data. You have 25+ Play Store reviews. One content piece (Reddit, TikTok, or LinkedIn) has broken out with meaningful reach.

---

## Path to 1,000 Users

**Primary channels:** Product Hunt launch (requires iOS OR strong Android-only campaign) + content compounding + SEO starting to pay off
**Timeline:** 4–6 months from zero

This is the first milestone that requires a step-change event, not just compound execution. Getting from 500 to 1,000 purely through slow organic channels will take 4–6 additional months of consistent effort. To accelerate this, you need one big moment.

**The three possible "big moments":**

**Option A — iOS Launch + Product Hunt (recommended)**
iOS launch immediately unlocks 40–50% more addressable market. Product Hunt, timed to the iOS launch, creates a spike of 300–1,000 highly engaged early adopters in 48 hours. This is the cleanest path to 1,000.

**Option B — Viral TikTok Video**
If one video breaks out (100K+ views), you can go from 500 to 1,000 in 2–3 days. This is not predictable, but it becomes more likely with volume. At 30+ videos posted, the probability of one breaking through increases significantly.

**Option C — Reddit Front Page**
If a post reaches the front page of r/travel or r/solotravel, 500–2,000 installs in 48 hours is realistic. This is not predictable but becomes more likely with genuine community participation.

**Plan for Option A, but keep executing B and C in parallel.**

| Action | Users from this action | Cumulative |
|--------|----------------------|------------|
| 500 base (from above) | — | 500 |
| iOS launch | +30–50% conversion on all channels | — |
| Product Hunt launch (post-iOS) | 300–800 | 800–1,300 |
| SEO article ranking (month 4+) | 30–80/month | 530–580 |
| TikTok compounding (3–4 months in) | 80–200 | 610–780 |
| Invite mechanic compounding (more trips = more guests) | 100–200 | 710–980 |

**What you need to do:**
1. Build iOS. This is the work. Everything else is marketing. Ship iOS.
2. Prepare Product Hunt launch: 60-second demo video, compelling tagline, 20 supporters lined up.
3. Keep TikTok and Reddit going. Volume matters.
4. Check PostHog — find the biggest drop-off in the funnel and fix it (likely onboarding).

**What success looks like at 1,000:** You have clear organic growth signals in PostHog. SEO is starting to drive installs. TikTok has produced at least one video with 10K+ views. You have 50+ Play Store reviews and an average rating of 4.3+.

---

## Path to 2,500 Users

**Primary channels:** Content SEO compounding + community reputation + referral mechanic + App Store editorial consideration
**Timeline:** 8–12 months from zero

At 2,500 users, the product itself should be doing meaningful work if the invite mechanic is functional. 2,500 users creating trips and inviting groups of 4–8 means potentially 15,000–20,000 unique invite impressions. Even a 10% conversion on those impressions drives organic growth.

The challenge at this stage is sustainability. Many founders burn out of content creation by month 4–5. The goal at 2,500 is to have at least 2 self-sustaining growth engines that don't require your daily effort:
1. SEO (runs passively once articles rank)
2. The invite/viral mechanic (runs passively with every new trip)

Everything else (TikTok, Reddit, LinkedIn) requires ongoing effort.

| Action | Users from this action | Cumulative |
|--------|----------------------|------------|
| 1,000 base (from above) | — | 1,000 |
| SEO compound: 3–5 articles ranking | 100–300/month | 1,100–1,300 |
| Invite mechanic compound at scale | 200–400 | 1,300–1,700 |
| Referral program: "+7 days for referring a friend" | 150–300 | 1,450–2,000 |
| Micro-influencer pipeline (5–10 total) | 200–500 | 1,650–2,500 |
| App Store editorial (if applied for post-iOS) | 0–500 (unpredictable) | Variable |
| TikTok/Instagram compound (6+ months in) | 200–400 | 1,850–2,900 |

**New action at this stage: Referral Program**

Implement: "Invite a friend who creates their first trip → both get 7 bonus days."

Why this works at 2,500 but not at 50: You need existing users to have something worth referencing. At 2,500, you have enough trip data, reviews, and community presence that a referred user will actually convert. At 50 users, there's no social proof to land on.

Implementation: Low-complexity. When a user installs via an invite link from a registered user (not a trip invite), both accounts get a 7-day credit. Track via invite token analytics you already have.

**What you need to do:**
1. Publish 4–6 blog posts total. Focus on the high-intent clusters: Splitwise alternative, Wanderlog alternative, bachelorette trip planner, family vacation coordination.
2. Implement the referral program (bonus days).
3. Apply for App Store editorial consideration (iOS App Store has an "Apps We Love" submission form).
4. Start building a newsletter/email list — even 200 subscribers is an asset.
5. Consider building a simple web "trip planning tool" that captures SEO traffic and converts to app installs.

---

## Path to 10,000 Users

**Primary channels:** One big distribution event + compounding SEO + iOS App Store editorial or a viral moment
**Timeline:** 14–24 months from zero (without iOS: 24+ months)

Honest assessment: 10,000 users from zero at zero budget with one person takes 14–24 months for most apps. The apps that do it faster either get a viral moment (unpredictable) or an editorial feature (partly earned, partly luck). Plan for 18 months. Hope for 12.

**What changes between 2,500 and 10,000:**
- The organic flywheel must be generating 200+ installs/month with zero active effort
- SEO should be driving 150–400 installs/month (this requires 6–10 well-ranked articles)
- The viral mechanic (invites) should be generating 300–500 installs/month
- You need at least one "spike event" that adds 1,000–3,000 users at once

**The spike event options:**

| Event | Probability | Effort | Expected Users |
|-------|------------|--------|----------------|
| iOS App Store editorial ("Apps We Love") | 5–15% per application | Low (apply + wait) | 2,000–10,000 |
| TikTok video 1M+ views | 5–10% at high volume | Low (keep posting) | 500–2,000 |
| Major travel blog feature (Lonely Planet, etc.) | 5–10% with outreach | Medium | 500–3,000 |
| Product Hunt #1 of the day | 10–25% if well-executed | High (prep) | 300–1,000 |
| Viral Reddit post (r/travel front page) | 5–15% with quality content | Medium | 300–1,500 |
| App featured in a popular newsletter | 10–20% with outreach | Low (pitch) | 200–1,000 |

You cannot predict which spike event happens. You can maximize the probability of all of them by:
1. Having iOS (unlocks App Store editorial, Product Hunt properly, major app review sites)
2. Maintaining a consistent TikTok presence (volume → probability)
3. Having 5+ quality blog articles (increases chance of being cited by other blogs)
4. Building a relationship with the travel content creator community

**What success looks like at 10,000:** The app runs a positive viral loop (K-factor > 0.3). At least 2 passive growth channels (SEO + invite mechanic) are driving 400+ installs/month with no active effort. You have 200+ Play Store reviews, 4.4+ rating, and at least 1 iOS App Store editorial placement.

---

## WEEK-BY-WEEK 90-DAY EXECUTION PLAN

**Time commitment assumed:** 10–15 hours/week (founder has other obligations)
**Tracking:** PostHog (installs, activation, trip creation, invite rate)
**Weekly review:** Every Sunday, 30 minutes. Look at one metric: "How many trips were created this week?" Everything else is a proxy for this.

---

### WEEK 1 — Foundation Sprint

**Theme: Fix the basics before doing anything else. Every subsequent action is more effective if these are done first.**

**Monday–Tuesday (4 hours):**
- [ ] Update Play Store app name to "Vacationist — Group Trip Planner"
- [ ] Update short description to "Vote on activities, split expenses, sync in real time"
- [ ] Update keyword field with new keyword set (see marketing-strategy.md)
- [ ] Increase free tier day limit from 15 → 30 days (code change + deploy OTA update)

**Wednesday–Thursday (4 hours):**
- [ ] Take 7 real device screenshots from the app (use your Android phone, use a real-looking demo trip "Barcelona Summer 2026")
- [ ] Upload new screenshots to Play Store
- [ ] Install PostHog. Add the React Native SDK. Track: app_open, trip_created, invite_sent, invite_accepted, expense_created, vote_cast. These 6 events will tell you everything.

**Friday–Saturday (3 hours):**
- [ ] Rebuild `docs/join.html` (the invite page). Add: screenshots of key features, "3 members already joined" social proof mechanic, Vacationist branding, "Want to plan your own trip? Free download" CTA below the fold.
- [ ] Create TikTok account: @vacationist.app. Write bio. Add Play Store link.
- [ ] Create Instagram account: @vacationist.app.

**Sunday (1 hour):**
- [ ] Write the list of 80 people you'll personally message next week. Segment into: regular travelers, Splitwise users, people who complained about group trip chaos.

**Week 1 target:** 0 new users from growth actions (this week is all setup). But every subsequent action is 20–40% more effective because the foundations are right.

---

### WEEK 2 — Personal Network Blitz

**Theme: Do the things that don't scale. Get the first real users. Get the first reviews.**

**Monday (2 hours):**
- [ ] Send 20 personal messages (batch 1 — closest friends who travel). Individual messages, not a group.
- [ ] Message format: personal context → what you built → genuine ask → link

**Tuesday (2 hours):**
- [ ] Send 20 personal messages (batch 2 — work/uni contacts who travel)

**Wednesday (1 hour):**
- [ ] Film and post TikTok video #1: "Planning a 10-person trip in 3 minutes" (screen recording of the app with voice narration)

**Thursday (2 hours):**
- [ ] Send 20 personal messages (batch 3 — family, extended network, travel-adjacent contacts)
- [ ] Follow up on Monday batch: "Did you get a chance to try it? What was confusing?"

**Friday (2 hours):**
- [ ] Write and post the LinkedIn "why I built this" story
- [ ] Film and post TikTok video #2: "Nobody talks about this group trip problem" (relatable chaos → app solution)

**Saturday (1 hour):**
- [ ] Send 20 personal messages (batch 4 — fill in remaining names from your list)
- [ ] Begin identifying 15–20 micro-influencer targets on TikTok/Instagram

**Sunday (1 hour):**
- [ ] Check PostHog. How many installs this week? How many trips created? How many invites sent?
- [ ] Follow up with anyone who installed but hasn't created a trip: "Did you get a chance to create a trip?"

**Week 2 target:** 25–50 installs, 5–15 trip creations, first 3–5 Play Store reviews.

---

### WEEK 3 — Reddit & First Content

**Theme: Expand beyond personal network. Start building community credibility.**

**Monday (2 hours):**
- [ ] Create Reddit account (if not already active). Set up profile genuinely.
- [ ] Post first genuine value post in r/travel: "Planning a group trip to [destination] — breakdown of what worked and what didn't" — genuine trip report, no promotion, natural mention of the app if it comes up in discussion
- [ ] TikTok video #3: "The vote reveal — when your group finally agrees on something" (15–30 seconds, the vote animation)

**Tuesday–Wednesday (3 hours):**
- [ ] Send outreach DMs to first 10 micro-influencer targets (personalized, barter offer)
- [ ] Start writing the first SEO blog article: "Best Splitwise Alternatives for Group Travel in 2026" (aim to publish by end of week 4)

**Thursday (2 hours):**
- [ ] Actively comment on 10+ posts in r/travel, r/solotravel, r/camping with genuinely helpful responses (no promotion)
- [ ] TikTok video #4: "5 apps I deleted when I found one that does everything" (show icons disappearing → Vacationist)

**Friday (1 hour):**
- [ ] Follow up on micro-influencer DMs sent earlier this week
- [ ] Respond to every Play Store review so far (even if just "thank you!")

**Saturday (1 hour):**
- [ ] Post in r/shoestring or r/solotravel: a helpful comment on a group travel thread
- [ ] TikTok video #5: "POV: you're the friend who always plans the trip" (relatable hook → solution)

**Sunday (1 hour):**
- [ ] Review PostHog. Which source is driving the most installs? (UTM parameters or referral source)
- [ ] Are invites being sent from the app? What's the invite acceptance rate?

**Week 3 target:** 30–60 cumulative installs, 8+ trip creations, 5+ Play Store reviews, 3–5 micro-influencer outreach sent.

---

### WEEK 4 — Content Production Week

**Theme: Build the assets that will work without you. First SEO article. Better TikTok rhythm.**

**Monday–Wednesday (6 hours):**
- [ ] Finish and publish the first SEO blog article: "Best Splitwise Alternatives for Group Travel in 2026"
  - Must be hosted at vacationist.app/blog/ (build the blog page structure first)
  - Length: 2,500+ words
  - Must include real screenshots of Vacationist
  - Submit to Google Search Console for indexing

**Thursday (2 hours):**
- [ ] TikTok video #6: "How to split €800 of trip expenses between 6 people in 30 seconds" (expense demo)
- [ ] Post first German-language Reddit content in r/Reisen (value-first, no promotion)

**Friday (2 hours):**
- [ ] Follow up with any micro-influencer who responded positively — send Pro access code
- [ ] Ask the first 10 personal-network users who have used the app for 2+ weeks for a Play Store review (direct message, not in-app prompt)

**Saturday (1 hour):**
- [ ] TikTok video #7: "What happens when your 10-person group finally makes a decision" (vote reveal with satisfying resolution)

**Sunday (1 hour):**
- [ ] Weekly review. Cumulative installs? Trips created? Invite conversion rate?
- [ ] Identify: which content format is getting the most engagement on TikTok?

**Week 4 target:** 60–100 cumulative installs, 15+ trip creations, 10+ Play Store reviews, 1 SEO article published.

---

### WEEK 5 — Momentum Building

**Theme: Double down on what's working. Start seeing early signals.**

**Monday (1 hour):**
- [ ] TikTok video #8: respond to a comment or question from your previous videos (shows engagement, the algorithm rewards replies)
- [ ] Post a genuine trip-planning tip on LinkedIn (not a product pitch — a useful tip about expense splitting or group coordination)

**Tuesday–Wednesday (3 hours):**
- [ ] Post second Reddit post: a case study style — "How we coordinated a 9-person trip — the tools and system we used"
- [ ] Start writing second SEO article: "Best Wanderlog Alternatives That Do Expense Splitting"

**Thursday (2 hours):**
- [ ] TikTok video #9: "The one feature that saved our group trip" (group_blocker vote explanation — make it relatable)
- [ ] If any micro-influencer has used the app: check in, ask for their thoughts

**Friday (2 hours):**
- [ ] German-language content: post in r/de or a relevant German Facebook group
- [ ] TikTok video #10: "Packing list for 8 people camping — how we split it" (shopping list + recipe feature)

**Saturday (1 hour):**
- [ ] Review and reply to all TikTok comments. Engagement signals matter.
- [ ] Check if the LinkedIn post from week 2 is still generating interest (follow up with anyone who commented)

**Sunday (1 hour):**
- [ ] PostHog review. By now you should start seeing organic installs (not from people you personally messaged). Where are they coming from?

**Week 5 target:** 80–140 cumulative installs. At least 2–3 installs you don't know personally (organic).

---

### WEEK 6 — First Inflection Point Assessment

**Theme: Honest mid-point review. What's working? Double down. What's not? Cut it.**

**Monday–Tuesday (3 hours):**
- [ ] Audit PostHog data: What's the funnel? (Install → trip creation → invite sent → invite accepted) Where is the biggest drop-off?
- [ ] If invite acceptance is low → fix the join page further
- [ ] If trip creation is low → the onboarding is confusing → write a 60-second "how to get started" in the app description or in-app tips

**Wednesday (2 hours):**
- [ ] TikTok video #11: "I tried to plan a trip in every app so you don't have to" (comparison video — honest, not a pure pitch)
- [ ] Publish second SEO article if ready

**Thursday (2 hours):**
- [ ] Reach out to 5 more micro-influencers (second wave)
- [ ] Post third Reddit value post (by now you should have enough karma to post in more subreddits)

**Friday–Saturday (2 hours):**
- [ ] TikTok videos #12 and #13 (maintain rhythm)
- [ ] Check Play Store reviews. Are there any critical reviews mentioning the same friction points? Fix those.

**Sunday (2 hours):**
- [ ] 6-week review. Write a honest 1-page document (just for yourself) answering:
  - How many installs? Source breakdown?
  - How many trips created?
  - How many invites sent per trip (average)?
  - How many invite acceptances (conversion rate)?
  - What's the #1 reason people stop using the app after installing?
  - What's working best in content?
  - What should stop?

**Week 6 target:** 120–200 cumulative installs, 20+ trip creations, 15+ Play Store reviews.

---

### WEEK 7–8 — iOS Preparation Sprint (Parallel with Content)

**Theme: While content runs on autopilot, build iOS. Every growth channel is more effective with iOS.**

**Content (maintain minimum viable rhythm):**
- [ ] TikTok: 2 videos/week (reduced from 3 — iOS build is the priority)
- [ ] Reddit: 2–3 helpful comments/week (no effort, keep presence)
- [ ] LinkedIn: 1 post (can be a "building iOS" update — authentic, builds anticipation)

**iOS work:**
- [ ] EAS iOS build profile setup
- [ ] Apple Developer account ($99/year — only required cost in this plan)
- [ ] TestFlight beta with 10–20 users from your personal network
- [ ] Prepare App Store screenshots (same set as Android screenshots, slightly resized)
- [ ] App Store listing text (same as Play Store with minor adjustments)
- [ ] Submit to App Store review

**Week 7–8 target:** iOS in TestFlight. 150–250 cumulative installs. One micro-influencer review published (if outreach from week 3–5 converted).

---

### WEEK 9–10 — iOS Launch & First Spike Event

**Theme: iOS launch creates the first significant growth event.**

**Week 9:**
- [ ] iOS App Store live (if approved) — announce on TikTok, LinkedIn, Reddit simultaneously
- [ ] TikTok: "iOS is LIVE" announcement video (show the App Store page, show download)
- [ ] Reddit: post in r/travel and r/solotravel — "after many requests, iOS is now available" — short, genuine
- [ ] LinkedIn: "iOS is live" update with genuine story of what it took
- [ ] Update landing page: add iOS App Store button next to Play Store button
- [ ] Update TikTok bio with App Store link

**Week 10 (Product Hunt preparation — launch in week 12 or 13):**
- [ ] Create Product Hunt maker profile
- [ ] Prepare 60-second demo video (this is the most important PH asset)
- [ ] Write PH description: "The group trip planner that replaced WhatsApp polls — vote on activities, split expenses, sync offline"
- [ ] Line up 20 supporters who will upvote on launch day (message personally, ask each one directly)
- [ ] Choose launch day: Tuesday, Wednesday, or Thursday

**Week 9–10 target:** iOS live. 250–400 cumulative installs. First genuine organic TikTok engagement.

---

### WEEK 11–12 — Product Hunt Launch

**Theme: The first concentrated spike event. One day to drive 300–800 installs.**

**Week 11 (pre-launch):**
- [ ] Final Product Hunt assets ready: video, screenshots, description, first comment
- [ ] Warm up supporters — "we're launching [day], will you upvote at 12:01 AM PST?"
- [ ] Post on LinkedIn and TikTok: "Big launch happening [day] — more details soon"
- [ ] Write the first comment for PH post in advance: the context, the story, the "why this exists"

**Week 12 (launch day):**
- [ ] Launch at exactly 12:01 AM PST
- [ ] Immediately post the link on: LinkedIn, TikTok, Reddit (r/startups, r/sideprojects, r/entrepreneur with genuine context), Twitter/X if active
- [ ] Be available all day to respond to every PH comment. Response rate and engagement time are major ranking factors.
- [ ] Reply to every TikTok, Instagram, LinkedIn comment mentioning the launch

**Post-launch:**
- [ ] Send personal thank you messages to every person who upvoted
- [ ] Check which signup source Product Hunt visitors convert from (PostHog)
- [ ] Email everyone who signed up from PH (even if it's just a thank you + how to get started)

**Week 11–12 target:** Product Hunt launch. Spike of 200–600 installs in 48 hours (if executed well). Cumulative total: 400–900 installs.

---

### WEEK 13 — Consolidation & Compounding

**Theme: The rush is over. Now build sustainable systems.**

- [ ] Analyze all data from the 90 days. Which channels drove real trips (not just installs)?
- [ ] Check SEO: is the first blog article ranking? Submit the second article.
- [ ] Resume TikTok at 3/week rhythm
- [ ] Identify: are there any users who have created 3+ trips? Reach out to them personally. They are your best advocates and early feedback source.
- [ ] Plan month 4: based on what worked, what's the next 4-week sprint?

---

## The One Thing That Ruins This Plan

**Inconsistency.**

The #1 reason zero-budget growth plans fail is not strategy — it's that the founder posts 3 TikToks, gets 150 views each, and stops. Then posts 1 Reddit post, gets 12 upvotes, and stops.

Content and community channels take 6–12 weeks to compound. The trough of low results before momentum kicks in is real. Most founders quit during that trough.

The antidote is **tracking leading indicators, not lagging ones:**

| Leading (you control) | Lagging (you measure) |
|----------------------|----------------------|
| TikToks posted this week | TikTok followers |
| Reddit comments this week | Reddit karma |
| Outreach messages sent | Micro-influencer replies |
| SEO articles published | Search rankings |
| Invite page conversion rate | Total installs |

If your leading indicators are green, the lagging ones will follow. Track leading indicators weekly. Evaluate lagging indicators monthly.

---

## Budget Breakdown

| Item | Cost |
|------|------|
| Apple Developer Account (iOS required) | €99/year |
| PostHog (free tier, up to 1M events) | €0 |
| All content creation (TikTok, Reddit, LinkedIn, Blog) | €0 |
| Micro-influencer barter (Pro subscriptions) | €0 cash |
| SEO / blog hosting (on existing vacationist.app) | €0 |
| Reddit accounts | €0 |
| Social accounts | €0 |
| Product Hunt launch | €0 |
| **Total cash required** | **€99** |

The €99 Apple Developer fee is the only unavoidable cash expense. Everything else is founder time.

---

## One-Page Summary

```
WEEKS 1–2:   Fix foundations (ASO, screenshots, invite page, analytics)
             Personal network blitz (80 individual messages)
             First TikToks + LinkedIn "why I built this"
             TARGET: 50–100 installs, 10+ reviews

WEEKS 3–4:   Reddit community seeding (value-first)
             Micro-influencer outreach (15–20 DMs)
             First SEO article published
             TikTok rhythm: 3/week
             TARGET: 100–200 installs, 15+ reviews

WEEKS 5–6:   Double down on what's working
             German market seeding
             Second SEO article
             Funnel analysis + fix biggest drop-off
             TARGET: 150–250 installs, 20+ reviews

WEEKS 7–8:   Build iOS (this is the work)
             Maintain content minimum viable rate
             TestFlight beta with 20 users
             TARGET: 200–350 installs

WEEKS 9–10:  iOS App Store launch
             All channels announce simultaneously
             Product Hunt preparation
             TARGET: 300–500 installs

WEEKS 11–12: Product Hunt launch
             First spike event: 200–600 installs in 48 hours
             TARGET: 500–900 cumulative installs

WEEK 13:     Consolidate. Analyze. Plan month 4.
             The compounding begins here.
             TARGET: 700–1,000 installs
```

---

## The Milestone That Actually Matters Most

It is not 250 users. It is not 1,000 users.

It is the moment when the **invite loop is self-sustaining** — when you can look at PostHog and see that new users are arriving from invite links sent by people you don't personally know.

That is the moment Vacationist stops being "an app you built" and starts being "an app that grows." Everything before that moment is building toward that moment. Every action in this plan is designed to make that moment arrive faster.

When you see that signal, double down on everything that led to it.
