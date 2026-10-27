
const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");

const router = express.Router();

const priorityRank = {
  High: 3,
  Medium: 2,
  Low: 1,
};

const priorityWeight = {
  High: 50,
  Medium: 30,
  Low: 10,
};

// GET: Retrieve all tasks
router.get("/", async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve tasks.",
    });
  }
});

// POST: Create a new task
router.post("/", async (req, res) => {
  try {
    const task = await Task.create(req.body);
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({
      message: "Failed to create task.",
      error: error.message,
    });
  }
});

// POST: Preview the plan and generate Start Small suggestions
router.post("/replan/preview", async (req, res) => {
  try {
    const availableMinutes = Number(req.body.availableMinutes);
    const currentEnergy = Number(req.body.currentEnergy);

    if (
      !Number.isInteger(availableMinutes) ||
      availableMinutes < 0
    ) {
      return res.status(400).json({
        message: "Available time must be a whole number of minutes, zero or more.",
      });
    }

    if (
      !Number.isInteger(currentEnergy) ||
      currentEnergy < 1 ||
      currentEnergy > 5
    ) {
      return res.status(400).json({
        message: "Current energy must be between 1 and 5.",
      });
    }

    const tasks = await Task.find({
      status: "Planned",
      $or: [
        { planDecision: "Today" },
        { planDecision: { $exists: false } },
        { planDecision: null },
      ],
    });

    const rankedTasks = tasks.map((task) => {
      const priority = task.priority || "Low";
      const energyDifference = Math.abs(
        Number(task.energyLevel) - currentEnergy
      );

      const energyScore = 25 - energyDifference * 8;
      const score =
        (priorityWeight[priority] ?? 10) + energyScore;

      return {
        task,
        priorityRank: priorityRank[priority] ?? 1,
        energyDifference,
        score,
      };
    });

    // Priority first, then energy match, then shorter duration.
    rankedTasks.sort((a, b) => {
      if (b.priorityRank !== a.priorityRank) {
        return b.priorityRank - a.priorityRank;
      }

      if (a.energyDifference !== b.energyDifference) {
        return a.energyDifference - b.energyDifference;
      }

      return (
        Number(a.task.plannedDuration) -
        Number(b.task.plannedDuration)
      );
    });

    let remainingMinutes = availableMinutes;
    const recommendations = [];

    for (const item of rankedTasks) {
      const task = item.task;
      const duration = Number(task.plannedDuration);
      const minutesAvailableBeforeTask = remainingMinutes;
      const energyGap = Number(task.energyLevel) - currentEnergy;

      let recommendation;
      let reason;

      if (duration <= remainingMinutes) {
        recommendation = "Today";
        remainingMinutes -= duration;

        if (energyGap >= 2) {
          reason =
            `${task.priority} priority is being protected, and ` +
            `this task fits within your available time. Its energy ` +
            `requirement (${task.energyLevel}/5) is higher than your ` +
            `current energy (${currentEnergy}/5). Consider starting small.`;
        } else {
          reason =
            `Kept for today because it fits your available time. ` +
            `${task.priority} priority was considered first, and its ` +
            `energy requirement is reasonably matched to your current energy.`;
        }
      } else {
        recommendation = "Tomorrow";

        reason =
          `This task needs ${duration} minutes, but only ` +
          `${minutesAvailableBeforeTask} minutes remain today. ` +
          `It does not fit in the remaining time.`;
      }

      // Start Small is only a suggestion; it does not modify the task.
      const shouldSuggestStartSmall =
        duration >= 10 &&
        minutesAvailableBeforeTask >= 10 &&
        (duration > minutesAvailableBeforeTask || energyGap >= 2);

      let startSmall = null;

      if (shouldSuggestStartSmall) {
        const suggestedMinutes = Math.min(15, duration);

        startSmall = {
          suggestedMinutes,
          reason:
            duration > minutesAvailableBeforeTask
              ? `The full task needs ${duration} minutes, but only ` +
                `${minutesAvailableBeforeTask} minutes remain. Try a ` +
                `${suggestedMinutes}-minute session to make some progress.`
              : `This task needs energy ${task.energyLevel}/5 while your ` +
                `current energy is ${currentEnergy}/5. Consider a gentle ` +
                `${suggestedMinutes}-minute starting session.`,
        };
      }

      recommendations.push({
        _id: task._id,
        title: task.title,
        category: task.category,
        plannedDuration: duration,
        energyLevel: task.energyLevel,
        priority: task.priority,
        score: item.score,
        recommendation,
        reason,
        startSmall,
      });
    }

    res.status(200).json({
      availableMinutes,
      currentEnergy,
      recommendedTasks: recommendations,
      estimatedMinutesKeptToday: recommendations
        .filter((task) => task.recommendation === "Today")
        .reduce(
          (total, task) => total + task.plannedDuration,
          0
        ),
      remainingMinutes,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not generate a replan.",
      error: error.message,
    });
  }
});

// POST: Save the user's planning decisions

router.post("/replan/apply", async (req, res) => {
  try {
    const { decisions } = req.body;

    if (!Array.isArray(decisions) || decisions.length === 0) {
      return res.status(400).json({
        message: "Provide at least one planning decision.",
      });
    }

    const allowedDecisions = ["Today", "Tomorrow", "Let go"];

    for (const decision of decisions) {
      if (!mongoose.isValidObjectId(decision.taskId)) {
        return res.status(400).json({
          message: "One of the task IDs is invalid.",
        });
      }

      if (!allowedDecisions.includes(decision.planDecision)) {
        return res.status(400).json({
          message: "Decision must be Today, Tomorrow, or Let go.",
        });
      }

      const minutes = decision.startSmallMinutes;

      if (
        decision.planDecision === "Today" &&
        minutes != null &&
        (!Number.isInteger(minutes) || minutes < 1 || minutes > 15)
      ) {
        return res.status(400).json({
          message: "A short-start session must be between 1 and 15 minutes.",
        });
      }
    }

    const results = [];

    for (const decision of decisions) {
      const update = {
        planDecision: decision.planDecision,
        startSmallMinutes:
          decision.planDecision === "Today"
            ? decision.startSmallMinutes ?? null
            : null,
      };

      if (decision.planDecision === "Tomorrow") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        update.plannedDate = tomorrow;
      } else if (decision.planDecision === "Today") {
        update.plannedDate = new Date();
      }

      const task = await Task.findOneAndUpdate(
        {
          _id: decision.taskId,
          status: "Planned",
        },
        update,
        {
          new: true,
          runValidators: true,
        }
      );

      if (task) {
        results.push(task);
      }
    }

    res.status(200).json({
      message: "Planning decisions saved.",
      tasks: results,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not save planning decisions.",
      error: error.message,
    });
  }
});


// PATCH: Log task outcome
router.patch("/:id/log", async (req, res) => {
  try {
    const { status, actualDuration, actualEnergy } = req.body;
    const allowedStatuses = ["Done", "Partial", "Skipped"];

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid task ID.",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Status must be Done, Partial, or Skipped.",
      });
    }

    const duration = Number(actualDuration);
    const energy = Number(actualEnergy);

    if (!Number.isFinite(duration) || duration < 0) {
      return res.status(400).json({
        message: "Actual duration must be zero or more.",
      });
    }

    if (!Number.isInteger(energy) || energy < 1 || energy > 5) {
      return res.status(400).json({
        message: "Actual energy must be between 1 and 5.",
      });
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      {
        status,
        actualDuration: duration,
        actualEnergy: energy,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    res.status(200).json(task);
  } catch (error) {
    res.status(400).json({
      message: "Could not log task.",
      error: error.message,
    });
  }
});

// DELETE: Permanently delete a task
router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid task ID.",
      });
    }

    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: "Task not found.",
      });
    }

    res.status(200).json({
      message: "Task deleted successfully.",
      id: req.params.id,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not delete task.",
    });
  }
});

module.exports = router;
