import type { AuthUser } from '../api';
import { AuthControls } from './AuthControls';

interface LandingPageProps {
  user: AuthUser | null;
  onLogin: (username: string, password: string) => Promise<string | null>;
  onRegister: (username: string, password: string) => Promise<string | null>;
  onLogout: () => void;
}

export function LandingPage({ user, onLogin, onRegister, onLogout }: LandingPageProps) {
  return (
    <div className="landing">
      {/* Hero Section */}
      <section className="landing-hero">
        <h1 className="landing-logo">⏱️ Do Again List</h1>
        <p className="landing-tagline">
          Track the things you want to do more, or less, without
          stressing over perfect data.
        </p>
        <div className="landing-auth-box">
          <AuthControls user={user} onLogin={onLogin} onRegister={onRegister} onLogout={onLogout} />
        </div>
      </section>

      {/* Philosophy */}
      <section className="landing-section">
        <h2>Built for real life, not spreadsheets</h2>
        <p>
          Most habit trackers punish you the moment you miss a day. <strong>Do
          Again List</strong> is different. It knows you're busy. It knows
          you'll forget. The whole point is to <em>do the thing</em>, not to
          perfectly maintain a streak in an app. Log roughly when something
          happened and move on with your life.
        </p>
      </section>

      {/* Quick Time Inputs */}
      <section className="landing-section landing-section-alt">
        <h2>Log times however is fastest</h2>
        <p>
          Did you go for a run an hour ago? Type <code>1h</code>. Half a day?
          <code>12h</code>. Two days and change? <code>2d3h</code>. You can
          also type a clock time like <code>10:30am</code> or <code>1pm</code>
          and the app figures out the rest. Leave the field blank and it
          records "right now." No date pickers, no calendars&mdash;just fast,
          approximate timestamps so you can get back to what matters.
        </p>
        <div className="landing-examples">
          <div className="landing-example-chip"><code>1h30m</code> <span>→ 1 hr 30 min ago</span></div>
          <div className="landing-example-chip"><code>2d</code> <span>→ 2 days ago</span></div>
          <div className="landing-example-chip"><code>10:30am</code> <span>→ last 10:30 AM</span></div>
          <div className="landing-example-chip"><code>blank</code> <span>→ right now</span></div>
        </div>
      </section>

      {/* Activities */}
      <section className="landing-section">
        <h2>Activities that adapt to you</h2>
        <p>
          Create an <strong>Activity</strong> for anything you want to track:
          exercise, reading, laundry, practicing guitar&mdash;whatever.
          Each Activity lives on a card that shows how long since you last did
          it and countdowns for when you should (or shouldn't) do it again.
        </p>
        <p>
          Set a <em>min time between</em> for things you want to do less often,
          or a <em>max time between</em> for things you need to do more.
          Combine both if you want a sweet spot. Start an Activity, end it when
          you're done, and see the timer reset. You can also create
          <strong> Pending</strong> activities that sit in a sidebar until
          you're ready to start them, and <strong>One-Time</strong> tasks that
          drop off your list once they're done.
        </p>
      </section>

      {/* Battle Game */}
      <section className="landing-section landing-section-alt">
        <h2>A tiny RPG that runs on your habits</h2>
        <p>
          Every time you create or complete an Activity, something happens in a
          little side-scrolling battle that lives at the top of the page.
          Adding a new Activity can spawn an enemy. Finishing one on time
          buffs your hero's stats and can even heal them. Finishing late
          causes fatigue.
        </p>
        <p>
          Your hero earns <strong>XP</strong> and <strong>Gold</strong>,
          levels up, and gets stronger&mdash;all powered by you actually
          doing the things you said you'd do. It's a small, fun reward loop
          that makes checking off a chore feel a little bit like slaying a
          dragon.
        </p>
        <div className="landing-game-preview">
          <div className="landing-game-bar">
            <span className="stat">⚔️ ATK 5</span>
            <span className="stat">🛡️ DEF 3</span>
            <span className="stat">💨 SPD 4</span>
            <span className="stat">✨ LVL 2</span>
          </div>
        </div>
      </section>

      {/* Code Names */}
      <section className="landing-section">
        <h2>Code names: make it yours</h2>
        <p>
          Don't want your screen to read like a chore list or don't want to spell
          out every bad habit for someone to see over your shoulder? Give any Activity a
          <strong> Code Name</strong> and toggle between normal names and code
          names with one click. Your mundane tasks become quests:
        </p>
        <div className="landing-codename-demo">
          <div className="landing-codename-card">
            <div className="landing-cn-normal">
              <span className="landing-cn-label">Normal</span>
              <span className="landing-cn-name">🧺 Laundry</span>
            </div>
            <span className="landing-cn-arrow">→</span>
            <div className="landing-cn-code">
              <span className="landing-cn-label">Code Name</span>
              <span className="landing-cn-name landing-cn-glow">⚔️ Repair Armor</span>
            </div>
          </div>
        </div>
        <p>
          Toggle the <span className="landing-toggle-icon">🪩</span> / <span className="landing-toggle-icon">🧶</span> button
          in the toolbar whenever you want to switch. It's a small thing, but
          it makes the list a little more fun to look at.
        </p>
      </section>

      {/* Call to Action */}
      <section className="landing-cta">
        <h2>Ready to stop tracking and start doing?</h2>
        <p>Create an account in seconds. No email required.</p>
        <div className="landing-auth-box">
          <AuthControls user={user} onLogin={onLogin} onRegister={onRegister} onLogout={onLogout} />
        </div>
      </section>
    </div>
  );
}
