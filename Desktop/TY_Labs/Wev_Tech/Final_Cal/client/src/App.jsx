
import { useEffect, useState } from "react";
import "./App.css";
const API_URL = "http://localhost:5000/api/tasks";
const AUTH_URL = "http://localhost:5000/api/auth";

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [logging, setLogging] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [loggingTaskId, setLoggingTaskId] = useState(null);

  const [showReplanner, setShowReplanner] = useState(false);
  const [availableMinutes, setAvailableMinutes] = useState(120);
  const [currentEnergy, setCurrentEnergy] = useState(3);
  const [recommendations, setRecommendations] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [startSmallSelections, setStartSmallSelections] = useState({});  const [planning, setPlanning] = useState(false);
  const [applyingPlan, setApplyingPlan] = useState(false);
  
const [currentTime, setCurrentTime] = useState(new Date());

const [timerTaskId, setTimerTaskId] = useState(null);
const [timerRemainingSeconds, setTimerRemainingSeconds] = useState(0);
const [timerInitialSeconds, setTimerInitialSeconds] = useState(0);
const [timerRunning, setTimerRunning] = useState(false);



const [authChecking, setAuthChecking] = useState(true);
const [user, setUser] = useState(null);
const [authMode, setAuthMode] = useState("login");
const [authForm, setAuthForm] = useState({
  name: "",
  email: "",
  password: "",
});
const [authLoading, setAuthLoading] = useState(false);
const [authError, setAuthError] = useState("");


  const [form, setForm] = useState({
    title: "",
    category: "College",
    plannedDuration: 30,
    energyLevel: 3,
    priority: "Medium",
  });

  const [logForm, setLogForm] = useState({
    status: "Done",
    actualDuration: 30,
    actualEnergy: 3,
  });

  async function loadTasks() {
    try {
      setError("");
const response = await fetch(API_URL, {
  credentials: "include",
});
      if (!response.ok) {
        throw new Error("Could not load tasks.");
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("The tasks API did not return a list.");
      }

      setTasks(data);
    } catch (err) {
      setError(err.message + " Make sure your backend is running.");
    } finally {
      setLoading(false);
    }
  }


  async function handleAuthSubmit(event) {
  event.preventDefault();
  setAuthError("");
  setAuthLoading(true);

  try {
    const response = await fetch(`${AUTH_URL}/${authMode}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(authForm),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Authentication failed.");
    }

    setUser(data.user);
    setAuthForm({
      name: "",
      email: "",
      password: "",
    });

    await loadTasks();
  } catch (error) {
    setAuthError(error.message || "Something went wrong.");
  } finally {
    setAuthLoading(false);
  }
}

  useEffect(() => {
  async function checkLogin() {
    try {
      const response = await fetch(`${AUTH_URL}/me`, {
        credentials: "include",
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = await response.json();
      setUser(data.user);
      await loadTasks();
    } catch (error) {
      console.error("Login check failed:", error);
      setUser(null);
    } finally {
      setAuthChecking(false);
    }
  }

  checkLogin();
}, []);
  
/* Update the live clock every second. */
useEffect(() => {
  const clockInterval = setInterval(() => {
    setCurrentTime(new Date());
  }, 1000);

  return () => clearInterval(clockInterval);
}, []);

/* Count down while a focus session is running. */
useEffect(() => {
  if (!timerRunning) return;

  const timerInterval = setInterval(() => {
    setTimerRemainingSeconds((remaining) => {
      if (remaining <= 1) {
        setTimerRunning(false);
        setNotice("Your focus session is complete. You can stop here or continue when you're ready.");
        return 0;
      }

      return remaining - 1;
    });
  }, 1000);

  return () => clearInterval(timerInterval);
}, [timerRunning]);





function startSmallTimer(task) {
  const minutes = Number(task.startSmallMinutes);

  if (!minutes || minutes < 1) {
    setError("Save a Start Small session before starting the timer.");
    return;
  }

  // Resume this task if its timer is paused.
  if (timerTaskId === task._id && timerRemainingSeconds > 0) {
    setTimerRunning(true);
    setError("");
    return;
  }

  // Start a fresh timer for this task.
  const durationInSeconds = minutes * 60;

  setTimerTaskId(task._id);
  setTimerInitialSeconds(durationInSeconds);
  setTimerRemainingSeconds(durationInSeconds);
  setTimerRunning(true);
  setError("");
  setNotice(`Your ${minutes}-minute session for "${task.title}" has started. One step at a time.`);
}

function pauseSmallTimer() {
  setTimerRunning(false);
}

function resetSmallTimer() {
  setTimerRunning(false);
  setTimerRemainingSeconds(timerInitialSeconds);
}

function formatTimer(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}


  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(API_URL, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          plannedDuration: Number(form.plannedDuration),
          energyLevel: Number(form.energyLevel),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not save the task.");
      }

      setTasks((current) => [data, ...current]);
      setNotice("Task added. Take it one step at a time.");

      setForm({
        title: "",
        category: "College",
        plannedDuration: 30,
        energyLevel: 3,
        priority: "Medium",
      });
    } catch (err) {
      setError(err.message + " Check that MongoDB is connected.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
  try {
    const response = await fetch(`${AUTH_URL}/logout`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Could not log out. Please try again.");
    }

    setUser(null);
    setTasks([]);
    setAuthError("");
    setAuthMode("login");
  } catch (error) {
    setAuthError(error.message || "Logout failed.");
  }
}


function switchAuthMode(mode) {
  setAuthMode(mode);
  setAuthError("");
  setAuthForm({
    name: "",
    email: "",
    password: "",
  });
}

  function openLogForm(task) {
    setLoggingTaskId(task._id);

    setLogForm({
      status: task.status === "Planned" ? "Done" : task.status,
      actualDuration: task.actualDuration ?? task.plannedDuration,
      actualEnergy: task.actualEnergy ?? task.energyLevel,
    });

    setError("");
    setNotice("");
  }

  function handleLogChange(event) {
    const { name, value } = event.target;

    setLogForm((current) => ({
      ...current,
      [name]: name === "actualEnergy" ? Number(value) : value,
    }));
  }

  
async function handleLogSubmit(event, taskId) {
  event.preventDefault();
  setLogging(true);
  setError("");
  setNotice("");

  try {
    const moveToTomorrow =
      logForm.status === "Partial" ||
      logForm.status === "Skipped";

    // Calculate tomorrow using the local calendar date.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const response = await fetch(`${API_URL}/${taskId}/log`, {
      credentials: "include",
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: logForm.status,
        actualDuration: Number(logForm.actualDuration),
        actualEnergy: Number(logForm.actualEnergy),
        ...(moveToTomorrow
          ? {
              planDecision: "Tomorrow",
              plannedDate: tomorrow.toISOString(),
            }
          : {}),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not save the outcome.");
    }

    setTasks((current) =>
      current.map((task) => (task._id === taskId ? data : task))
    );

    setLoggingTaskId(null);

    if (moveToTomorrow) {
      setNotice(
        `Your task is saved for tomorrow. Your ${
          logForm.status.toLowerCase()
        } outcome has been recorded.`
      );
    } else {
      setNotice("Outcome saved. Every bit of progress counts.");
    }
  } catch (err) {
    setError(err.message);
  } finally {
    setLogging(false);
  }
}


  async function handleDelete(task) {
    const confirmed = window.confirm(
      `Delete "${task.title}" permanently? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingTaskId(task._id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_URL}/${task._id}`, {
          credentials: "include",
          method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not delete the task.");
      }

      setTasks((current) =>
        current.filter((item) => item._id !== task._id)
      );

      if (loggingTaskId === task._id) {
        setLoggingTaskId(null);
      }

      setNotice("Task deleted. Make space for what matters now.");
    } catch (err) {
      setError(err.message + " Please check your backend.");
    } finally {
      setDeletingTaskId(null);
    }
  }

  
function isSameLocalDay(dateValue, comparisonDate = new Date()) {
  if (!dateValue) return true;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return true;

  return (
    date.getFullYear() === comparisonDate.getFullYear() &&
    date.getMonth() === comparisonDate.getMonth() &&
    date.getDate() === comparisonDate.getDate()
  );
}

// Authentication check - show login/signup page if not authenticated
if (authChecking) {
  return (
    <div className="auth-loading">
      <p>Preparing your calm space...</p>
    </div>
  );
}

if (!user) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">ebb.</div>

        <p className="auth-eyebrow">A LITTLE LESS PRESSURE</p>

        <h1>
          {authMode === "signup"
            ? "Make room for yourself."
            : "Welcome back."}
        </h1>

        <p className="auth-description">
          Plan gently. Adjust freely. Your day doesn't have to be perfect.
        </p>

        <form onSubmit={handleAuthSubmit} className="auth-form">
          {authMode === "signup" && (
            <div className="auth-field">
              <label htmlFor="auth-name">Your name</label>
              <input
                id="auth-name"
                type="text"
                placeholder="What should we call you?"
                value={authForm.name}
                onChange={(event) =>
                  setAuthForm({
                    ...authForm,
                    name: event.target.value,
                  })
                }
                required
                maxLength={60}
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={authForm.email}
              onChange={(event) =>
                setAuthForm({
                  ...authForm,
                  email: event.target.value,
                })
              }
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              placeholder="At least 12 characters"
              value={authForm.password}
              onChange={(event) =>
                setAuthForm({
                  ...authForm,
                  password: event.target.value,
                })
              }
              required
              minLength={12}
              maxLength={72}
            />
          </div>

          {authError && (
            <p className="auth-error" role="alert">
              {authError}
            </p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={authLoading}
          >
            {authLoading
              ? "One moment..."
              : authMode === "signup"
                ? "Create my account"
                : "Log in"}
          </button>
        </form>

        <p className="auth-switch">
          {authMode === "signup"
            ? "Already have an account?"
            : "New to ebb?"}{" "}
          <button
            type="button"
            onClick={() =>
              switchAuthMode(
                authMode === "signup" ? "login" : "signup"
              )
            }
          >
            {authMode === "signup" ? "Log in" : "Create an account"}
          </button>
        </p>

        <p className="auth-footer">
          Progress over perfection. Always.
        </p>
      </section>
    </main>
  );
}

// Calculate tomorrow relative to the live clock.
const tomorrowDate = new Date(currentTime);
tomorrowDate.setDate(tomorrowDate.getDate() + 1);

const tomorrowLabel = tomorrowDate.toLocaleDateString("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

// Today's list is based on the planned calendar date.
// The "Let go" decision is always excluded.
const todayTasks = tasks.filter((task) => {
  return (
    task.planDecision !== "Let go" &&
    isSameLocalDay(task.plannedDate, currentTime) &&
    task.status !== "Done"
  );
});

// Show tasks scheduled for tomorrow in the tomorrow tray.
const tomorrowTasks = tasks.filter((task) => {
  return (
    task.planDecision !== "Let go" &&
    isSameLocalDay(task.plannedDate, tomorrowDate) &&
    task.status !== "Done"
  );
});

  const letGoTasks = tasks.filter(
    (task) => task.planDecision === "Let go" && task.status === "Planned"
  );

  
async function generateReplan() {
  setPlanning(true);
  setError("");
  setNotice("");

  try {
    const response = await fetch(`${API_URL}/replan/preview`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        availableMinutes: Number(availableMinutes),
        currentEnergy: Number(currentEnergy),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not create a plan.");
    }

    const items = data.recommendedTasks || [];

    setRecommendations(items);

    setDecisions(
      Object.fromEntries(
        items.map((task) => [
          task._id,
          task.recommendation,
        ])
      )
    );

    setStartSmallSelections(
      Object.fromEntries(
        items
          .filter((task) => task.startSmallMinutes)
          .map((task) => [
            task._id,
            task.startSmallMinutes,
          ])
      )
    );

    setShowReplanner(true);

    if (items.length === 0) {
      setNotice("You have no planned tasks to rework right now.");
    }
  } catch (err) {
    setError(err.message + " Make sure your backend is running.");
  } finally {
    setPlanning(false);
  }
}


  function changeDecision(taskId, planDecision) {
    setDecisions((current) => ({ ...current, [taskId]: planDecision }));
  }

  
async function saveReplan() {
  const chosenDecisions = recommendations.map((task) => {
    const planDecision =
      decisions[task._id] || task.recommendation;

    return {
      taskId: task._id,
      planDecision,
      startSmallMinutes:
        planDecision === "Today"
          ? startSmallSelections[task._id] || null
          : null,
    };
  });

  if (chosenDecisions.length === 0) {
    setShowReplanner(false);
    return;
  }

  setApplyingPlan(true);
  setError("");
  setNotice("");

  try {
    const response = await fetch(`${API_URL}/replan/apply`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisions: chosenDecisions,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not save your plan.");
    }

    // Refresh the main page from MongoDB after saving.
    await loadTasks();

    setShowReplanner(false);
    setRecommendations([]);
    setDecisions({});
    setStartSmallSelections({});

    setNotice(
      "Your plan has been saved and your main page is updated."
    );
  } catch (err) {
    setError(err.message);
  } finally {
    setApplyingPlan(false);
  }
}


  const completedCount = todayTasks.filter(
    (task) => task.status === "Done"
  ).length;

  const partialCount = todayTasks.filter(
    (task) => task.status === "Partial"
  ).length;

  const skippedCount = todayTasks.filter(
    (task) => task.status === "Skipped"
  ).length;

  const plannedCount = todayTasks.filter(
    (task) => task.status === "Planned"
  ).length;

  
const plannedMinutes = todayTasks
  .filter((task) => task.status === "Planned")
  .reduce(
    (total, task) => total + Number(task.plannedDuration || 0),
    0
  );


  const loggedCount = completedCount + partialCount + skippedCount;

  
//     const tomorrowDate = new Date();
// tomorrowDate.setDate(tomorrowDate.getDate() + 1);

// const tomorrowLabel = tomorrowDate.toLocaleDateString("en-IN", {
//   weekday: "short",
//   day: "numeric",
//   month: "short",
// });

  // Find tasks completed today or in the previous two days.
const completedRecentTasks = tasks
  .filter((task) => {
    if (task.status !== "Done") return false;

    const completedDate = new Date(
      task.updatedAt || task.plannedDate
    );

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - 2);


    return (
      !Number.isNaN(completedDate.getTime()) &&
      completedDate >= startDate &&
      completedDate <= new Date()
    );
  })
  .sort(
    (a, b) =>
      new Date(b.updatedAt || b.plannedDate) -
      new Date(a.updatedAt || a.plannedDate)
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ebb home">
        
{user && (
  <div className="account-controls">
    <span className="account-greeting">
      Hi, {user.name}
    </span>
    <button
      type="button"
      className="logout-button"
      onClick={handleLogout}
    >
      Log out
    </button>
  </div>
)}

          <span className="brand-icon">~</span>
          ebb<span className="brand-dot">.</span>
        </a>

        <span className="topbar-label">
          YOUR GUILT-FREE SPACE
        </span>
      </header>

      <section className="welcome">
        <p className="eyebrow">A LITTLE PROGRESS IS STILL PROGRESS</p>
        <h1>
          Make room for <span>real life.</span>
        </h1>
        <p className="subtitle">
          Plan gently. Do what you can. Adjust without guilt.
        </p>
      </section>

      <section className="stats">
        <article className="stat-card">
          <span className="stat-icon">✳</span>
          <span className="stat-label">YOUR TASKS</span>
          <strong>{todayTasks.length}</strong>
          <span className="stat-note">Your day, your pace</span>
        </article>

        <article className="stat-card">
          <span className="stat-icon">◷</span>
          <span className="stat-label">TIME STILL PLANNED</span>
          <strong>
            {Math.floor(plannedMinutes / 60)}h {plannedMinutes % 60}m
          </strong>
          <span className="stat-note">Plans can always change</span>
        </article>

        <article className="stat-card">
          <span className="stat-icon">✿</span>
          <span className="stat-label">COMPLETED</span>
          <strong>{completedCount}</strong>
          <span className="stat-note">Every bit counts</span>
        </article>
      </section>



<section className="reality-strip">
  <div className="reality-strip-heading">
    <div>
      <p className="eyebrow">YOUR DAY, IN REAL TIME</p>
      <h2>
        {currentTime.getHours() < 12
          ? "Good morning."
          : currentTime.getHours() < 17
          ? "Good afternoon."
          : "Good evening."}
      </h2>
      <p className="section-subtitle">
        It's your day, and you can adjust it as you go.
      </p>
    </div>

    <div className="live-clock" aria-live="off">
      <span className="live-clock-dot" />
      <strong>
        {currentTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </strong>
      <span>YOUR LOCAL TIME</span>
    </div>
  </div>

  <div className="reality-strip-metrics">
    <article>
      <span>Tasks for today</span>
      <strong>
        {todayTasks.filter((task) => task.status === "Planned").length}
      </strong>
      <small>Still flexible</small>
    </article>

    <article>
      <span>Time still planned</span>
      <strong>
        {Math.floor(plannedMinutes / 60)}h {plannedMinutes % 60}m
      </strong>
      <small>Based on your current plan</small>
    </article>

    <article>
      <span>Completed today</span>
      <strong>{completedCount}</strong>
      <small>Every bit counts</small>
    </article>
  </div>

  <p className="reality-strip-note">
    Your plan is a guide, not a deadline. There's always room to adjust. 🌿
  </p>
</section>



      {(error || notice) && (
        <div
          className={error ? "feedback feedback-error" : "feedback feedback-success"}
          role={error ? "alert" : "status"}
        >
          <span>{error || notice}</span>
          <button
            type="button"
            className="feedback-close"
            onClick={() => {
              setError("");
              setNotice("");
            }}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <section className="replan-panel">
        <div className="replan-intro">
          <div>
            <p className="eyebrow">PLANS CAN CHANGE</p>
            <h2>Replan the rest of today</h2>
            <p className="section-subtitle">Match your plan to the time and energy you actually have.</p>
          </div>
          <button type="button" className="button-primary replan-open-button"
            onClick={showReplanner ? () => setShowReplanner(false) : generateReplan}
            disabled={planning || applyingPlan}>
            {planning ? "Thinking through your plan..." : showReplanner ? "Close planner" : "Help me replan"}
          </button>
        </div>

        {showReplanner && <div className="replan-content">
          <div className="replan-inputs">
            <div>
              <label htmlFor="availableMinutes">Time left today (minutes)</label>
              <input id="availableMinutes" type="number" min="0" step="1" value={availableMinutes}
                onChange={(event) => setAvailableMinutes(event.target.value)} />
            </div>
            <div>
              <label htmlFor="currentEnergy">Your energy right now</label>
              <select id="currentEnergy" value={currentEnergy}
                onChange={(event) => setCurrentEnergy(Number(event.target.value))}>
                <option value={1}>1 — Very low</option><option value={2}>2 — Low</option>
                <option value={3}>3 — Moderate</option><option value={4}>4 — High</option>
                <option value={5}>5 — Very high</option>
              </select>
            </div>
            <button type="button" className="button-secondary" onClick={generateReplan}
              disabled={planning || applyingPlan}>{planning ? "Recalculating..." : "Recalculate"}</button>
          </div>
          <p className="replan-explanation">Suggestions consider priority, energy fit, and available time. You are always in control of the final choices.</p>
          {recommendations.length > 0 ? <>
            <div className="replan-results-heading">
              <h3>Your suggested plan</h3>
              
<span>
  {recommendations
    .filter(
      (task) =>
        (decisions[task._id] || task.recommendation) === "Today"
    )
    .reduce(
      (total, task) =>
        total +
        Number(
          startSmallSelections[task._id] || task.plannedDuration
        ),
      0
    )}{" "}
  minutes kept for today
</span>

            </div>
            <div className="replan-list">
              {recommendations.map((task) => <article className="replan-task" key={task._id}>
                <div className="replan-task-top"><div><h4>{task.title}</h4>
                  <p className="task-meta">{task.plannedDuration} min · Energy {task.energyLevel}/5 · {task.priority} priority</p>
                  

{task.status === "Planned" && task.startSmallMinutes != null && (
  <div className="short-session-panel">
    <p className="actual-meta">
      Today's starting session: {task.startSmallMinutes} min
      {" · "}Original estimate: {task.plannedDuration} min
    </p>

    <div className="focus-timer">
      <div className="focus-timer-display">
        <span className="focus-timer-label">YOUR SMALL START</span>
        <strong>
          {timerTaskId === task._id
            ? formatTimer(timerRemainingSeconds)
            : formatTimer(Number(task.startSmallMinutes) * 60)}
        </strong>
        <span className="focus-timer-status">
          {timerTaskId === task._id && timerRemainingSeconds === 0
            ? "Session complete"
            : timerTaskId === task._id && timerRunning
            ? "You're in focus mode"
            : timerTaskId === task._id
            ? "Session paused"
            : "No pressure. Begin when ready."}
        </span>
      </div>

      <div className="focus-timer-actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            if (timerTaskId === task._id && timerRunning) {
              pauseSmallTimer();
            } else {
              startSmallTimer(task);
            }
          }}
        >
          {timerTaskId === task._id && timerRunning
            ? "Pause"
            : timerTaskId === task._id && timerRemainingSeconds > 0
            ? "Resume"
            : "Start timer"}
        </button>

        {timerTaskId === task._id && timerInitialSeconds > 0 && (
          <button
            type="button"
            className="button-secondary"
            onClick={resetSmallTimer}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  </div>
)}

</div>
                  <span className={`priority priority-${String(task.priority || "medium").toLowerCase()}`}>{task.priority}</span>
                </div>
                <p className="replan-reason">{task.reason}</p>
                {task.startSmall && (
                  <div className="start-small-card">
                    <div>
                      <strong>Start small: {task.startSmall.suggestedMinutes} minutes</strong>
                      <p>{task.startSmall.reason}</p>
                      <small>This is a short-session suggestion. Your original task estimate stays {task.plannedDuration} minutes, and the task will not be marked complete.</small>
                    </div>
                    
<button
  type="button"
  className="button-secondary"
  onClick={() => {
    changeDecision(task._id, "Today");

    setStartSmallSelections((current) => ({
      ...current,
      [task._id]: task.startSmall.suggestedMinutes,
    }));

    setNotice(
      `Start with ${task.startSmall.suggestedMinutes} minutes on "${task.title}". The original ${task.plannedDuration}-minute estimate will stay unchanged.`
    );
  }}
>
  Plan this short start
</button>

                  </div>
                )}
                <label htmlFor={`decision-${task._id}`}>Your decision</label>
                <select id={`decision-${task._id}`} value={decisions[task._id] || task.recommendation}
                  onChange={(event) => changeDecision(task._id, event.target.value)}>
                  <option value="Today">Keep today</option><option value="Tomorrow">Move to tomorrow</option>
                  <option value="Let go">Let go for now</option>
                </select>
              </article>)}
            </div>
            <div className="replan-actions">
              <button type="button" className="button-primary" onClick={saveReplan} disabled={applyingPlan}>
                {applyingPlan ? "Saving plan..." : "Save my plan"}</button>
              <button type="button" className="button-secondary" onClick={() => setShowReplanner(false)} disabled={applyingPlan}>Cancel</button>
            </div>
          </> : <p className="replan-empty">No planned tasks are available to replan. Add a task or check back later.</p>}
        </div>}
      </section>

      <section className="workspace">
        <div className="task-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR DAY, YOUR PACE</p>
              <h2>Today's tasks</h2>
              <p className="section-subtitle">
                There is no perfect way to have a day.
              </p>
            </div>

            <span className="task-count">{todayTasks.length} tasks</span>
          </div>

          {todayTasks.length > 0 && !loading && (
            <div className="mini-summary">
              <span>{plannedCount} planned</span>
              <span>{completedCount} done</span>
              <span>{partialCount} partial</span>
              <span>{skippedCount} skipped</span>
            </div>
          )}

          {loading ? (
            <div className="empty-state">
              <span className="empty-icon">☁</span>
              <p>Gathering your tasks...</p>
            </div>
          ) : todayTasks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">☁</span>
              <h3>A little room to breathe</h3>
              <p>
                Nothing on your list yet. Add a task whenever you're ready.
              </p>
            </div>
          ) : (
            <div className="task-list">
              {todayTasks.map((task) => (
                <article
                  className={`task-card task-card-${String(
                    task.status || "planned"
                  ).toLowerCase()}`}
                  key={task._id}
                >
                  <span className={`task-mark mark-${String(
                    task.status || "planned"
                  ).toLowerCase()}`}>
                    {task.status === "Done"
                      ? "✓"
                      : task.status === "Partial"
                      ? "◐"
                      : task.status === "Skipped"
                      ? "–"
                      : "○"}
                  </span>

                  <div className="task-details">
                    <div className="task-title-row">
                      <h3>{task.title}</h3>
                      <span className={`status-badge status-${String(
                        task.status || "planned"
                      ).toLowerCase()}`}>
                        {task.status}
                      </span>
                    </div>

                    <p className="task-meta">
                      {task.category} <span>·</span>{" "}
                      {task.plannedDuration} min <span>·</span>{" "}
                      Energy {task.energyLevel}/5
                    </p>

                    
{task.status === "Planned" && task.startSmallMinutes != null && (
  <div className="short-session-panel">
    <p className="actual-meta">
      Today's starting session: {task.startSmallMinutes} min
      {" · "}Original estimate: {task.plannedDuration} min
    </p>

    <div className="focus-timer">
      <div className="focus-timer-display">
        <span className="focus-timer-label">YOUR SMALL START</span>

        <strong>
          {timerTaskId === task._id
            ? formatTimer(timerRemainingSeconds)
            : formatTimer(Number(task.startSmallMinutes) * 60)}
        </strong>

        <span className="focus-timer-status">
          {timerTaskId === task._id && timerRemainingSeconds === 0
            ? "Session complete"
            : timerTaskId === task._id && timerRunning
            ? "You're in focus mode"
            : timerTaskId === task._id
            ? "Session paused"
            : "No pressure. Begin when ready."}
        </span>
      </div>

      <div className="focus-timer-actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => {
            if (timerTaskId === task._id && timerRunning) {
              pauseSmallTimer();
            } else {
              startSmallTimer(task);
            }
          }}
        >
          {timerTaskId === task._id && timerRunning
            ? "Pause"
            : timerTaskId === task._id && timerRemainingSeconds > 0
            ? "Resume"
            : "Start timer"}
        </button>

        {timerTaskId === task._id && timerInitialSeconds > 0 && (
          <button
            type="button"
            className="button-secondary"
            onClick={resetSmallTimer}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  </div>
)}


                    {task.status !== "Planned" && (
                      <p className="actual-meta">
                        Actual: {task.actualDuration} min
                        {" · "}Energy {task.actualEnergy}/5
                      </p>
                    )}

                    <div className="task-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => openLogForm(task)}
                        disabled={Boolean(deletingTaskId) || logging}
                      >
                        {task.status === "Planned"
                          ? "Log outcome"
                          : "Edit outcome"}
                      </button>

                      <button
                        type="button"
                        className="button-delete"
                        onClick={() => handleDelete(task)}
                        disabled={deletingTaskId === task._id}
                        aria-label={`Delete ${task.title}`}
                        title="Delete task"
                      >
                        {deletingTaskId === task._id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>

                    {loggingTaskId === task._id && (
                      <form
                        className="log-form"
                        onSubmit={(event) =>
                          handleLogSubmit(event, task._id)
                        }
                      >
                        <h4>How did it go?</h4>

                        <label htmlFor={`status-${task._id}`}>
                          Outcome
                        </label>
                        <select
                          id={`status-${task._id}`}
                          name="status"
                          value={logForm.status}
                          onChange={handleLogChange}
                        >
                          <option value="Done">Done</option>
                          <option value="Partial">Partial</option>
                          <option value="Skipped">Skipped</option>
                        </select>

                        <label htmlFor={`duration-${task._id}`}>
                          Actual time spent (minutes)
                        </label>
                        <input
                          id={`duration-${task._id}`}
                          name="actualDuration"
                          type="number"
                          min="0"
                          step="1"
                          value={logForm.actualDuration}
                          onChange={handleLogChange}
                          required
                        />

                        <label htmlFor={`energy-${task._id}`}>
                          Actual energy (1–5)
                        </label>
                        <select
                          id={`energy-${task._id}`}
                          name="actualEnergy"
                          value={logForm.actualEnergy}
                          onChange={handleLogChange}
                          required
                        >
                          <option value={1}>1 — Very low</option>
                          <option value={2}>2 — Low</option>
                          <option value={3}>3 — Moderate</option>
                          <option value={4}>4 — High</option>
                          <option value={5}>5 — Very high</option>
                        </select>

                        <div className="log-actions">
                          <button
                            type="submit"
                            className="button-primary"
                            disabled={logging}
                          >
                            {logging ? "Saving..." : "Save outcome"}
                          </button>

                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => setLoggingTaskId(null)}
                            disabled={logging}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  <span className={`priority priority-${String(
                    task.priority || "medium"
                  ).toLowerCase()}`}>
                    {task.priority}
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="form-section">
          <div className="form-heading-icon">✳</div>
          <p className="eyebrow">START SMALL</p>
          <h2>Add a task</h2>
          <p className="form-description">
            Give it a name. The rest can be flexible.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="title">What would you like to do?</label>
            <input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Study for CN"
              required
            />

            <label htmlFor="category">Category</label>
            <select
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
            >
              <option>College</option>
              <option>Personal</option>
              <option>Health</option>
              <option>Work</option>
              <option>General</option>
            </select>

            <label htmlFor="plannedDuration">
              Estimated time (minutes)
            </label>
            <input
              id="plannedDuration"
              name="plannedDuration"
              type="number"
              min="1"
              value={form.plannedDuration}
              onChange={handleChange}
              required
            />

            <label htmlFor="energyLevel">Energy needed</label>
            <select
              id="energyLevel"
              name="energyLevel"
              value={form.energyLevel}
              onChange={handleChange}
            >
              <option value={1}>1 — Very low</option>
              <option value={2}>2 — Low</option>
              <option value={3}>3 — Moderate</option>
              <option value={4}>4 — High</option>
              <option value={5}>5 — Very high</option>
            </select>

            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              name="priority"
              value={form.priority}
              onChange={handleChange}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>

            <button
              type="submit"
              className="button-primary add-task-button"
              disabled={saving}
            >
              {saving ? "Saving..." : "+ Add task"}
            </button>
          </form>

          <p className="gentle-reminder">
            A plan is a guide, not a promise. 🌿
          </p>
        </aside>
      </section>

      
<section className="task-trays">
  {/* Recently completed tray */}
  <section className="task-tray completed-tray">
    <div className="task-tray-heading">
      <div className="task-tray-heading-icon">✓</div>
      <div>
        <h2>Recently completed</h2>
        <p>A little progress is still progress.</p>
      </div>
      <span className="task-tray-period">Last 3 days</span>
    </div>

    {completedRecentTasks.length > 0 ? (
      <div className="tray-task-list">
        {completedRecentTasks.map((task) => (
          <article className="tray-task" key={task._id}>
            <div className="tray-task-icon">✓</div>
            <div className="tray-task-content">
              <h3>{task.title}</h3>
              <p>
                {task.category || "General"} ·{" "}
                {task.plannedDuration} min
              </p>
              <span className="tray-task-note">
                Every bit of progress counts.
              </span>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className="tray-empty">
        <span>✿</span>
        <p>
          Your recent wins will appear here.
          Every step counts, even the small ones.
        </p>
      </div>
    )}
  </section>

  {/* Planned for tomorrow tray */}
  <section className="task-tray tomorrow-tray">
    <div className="task-tray-heading">
      <div className="task-tray-heading-icon">↗</div>
      <div>
        <h2>Planned for tomorrow</h2>
        <p>There's room to begin again tomorrow.</p>
      </div>
      <span className="task-tray-period">{tomorrowLabel}</span>
    </div>

    {tomorrowTasks.length > 0 ? (
      <div className="tray-task-list">
        {tomorrowTasks.map((task) => (
          <article className="tray-task" key={task._id}>
            <div className="tray-task-icon">○</div>
            <div className="tray-task-content">
              <h3>{task.title}</h3>
              <p>
                {task.category || "General"} ·{" "}
                {task.plannedDuration} min
              </p>
              <span className="tray-task-note">
                Energy {task.energyLevel ?? "—"}/5 ·{" "}
                {task.priority || "Medium"} priority
              </span>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className="tray-empty">
        <span>☼</span>
        <p>
          Nothing planned for tomorrow yet.
          You can leave some room to breathe.
        </p>
      </div>
    )}
  </section>
</section>


      {letGoTasks.length > 0 && <section className="secondary-task-section">
        <p className="eyebrow">NO PRESSURE</p><h2>Let go for now</h2>
        <p className="section-subtitle">These tasks are saved, not deleted. You can revisit them whenever it feels right.</p>
        <div className="secondary-task-list">{letGoTasks.map((task) => <article className="secondary-task" key={task._id}>
          <div><h3>{task.title}</h3><p>{task.plannedDuration} min · {task.priority} priority</p></div>
        </article>)}</div>
      </section>}

      <footer>
        <p>You don't have to do everything today. 🌿</p>
      </footer>
    </main>
  );
}

export default App;
