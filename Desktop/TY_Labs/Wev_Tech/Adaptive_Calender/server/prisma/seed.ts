import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { TaskType, Priority, TaskStatus, BlockKind, BlockStatus, CheckinContext } from "../src/lib/enums.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding EnergyCal database...");

  // Clean existing seed data
  await prisma.rescheduleLog.deleteMany();
  await prisma.scheduleBlock.deleteMany();
  await prisma.energyCheckin.deleteMany();
  await prisma.task.deleteMany();
  await prisma.fixedEvent.deleteMany();
  await prisma.breakStat.deleteMany();
  await prisma.energyCurvePoint.deleteMany();
  await prisma.taskTypeStat.deleteMany();
  await prisma.user.deleteMany();

  // 1. Demo user
  const passwordHash = await bcrypt.hash("Demo1234!", 12);
  const user = await prisma.user.create({
    data: {
      email: "demo@energycal.app",
      name: "Alex Demo",
      passwordHash,
    },
  });
  console.log(`  ✓ User created: ${user.email}`);

  // 2. TaskTypeStats — correction factors per type
  const taskTypeStatData: Array<{ taskType: string; correctionFactor: number; sampleCount: number }> = [
    { taskType: TaskType.STUDY,     correctionFactor: 1.3,  sampleCount: 12 },
    { taskType: TaskType.DEEP_WORK, correctionFactor: 1.2,  sampleCount: 10 },
    { taskType: TaskType.ADMIN,     correctionFactor: 0.9,  sampleCount: 15 },
    { taskType: TaskType.CREATIVE,  correctionFactor: 1.15, sampleCount: 8  },
    { taskType: TaskType.PHYSICAL,  correctionFactor: 1.0,  sampleCount: 9  },
    { taskType: TaskType.MEETING,   correctionFactor: 0.85, sampleCount: 14 },
    { taskType: TaskType.OTHER,     correctionFactor: 1.0,  sampleCount: 11 },
  ];
  await prisma.taskTypeStat.createMany({
    data: taskTypeStatData.map((s) => ({ ...s, userId: user.id })),
  });
  console.log(`  ✓ TaskTypeStats created: ${taskTypeStatData.length} rows`);

  // 3. EnergyCurvePoints — 24 hours, bell-curve shape
  // Low overnight, rising morning, peak mid-morning, dip post-lunch, recovery evening, decline night
  const hourlyEnergy: number[] = [
    2.0, // 0
    1.8, // 1
    1.5, // 2
    1.5, // 3
    1.8, // 4
    2.5, // 5
    3.5, // 6
    5.0, // 7
    6.5, // 8
    7.8, // 9
    8.5, // 10
    9.0, // 11
    8.5, // 12
    7.5, // 13
    5.5, // 14
    4.5, // 15
    5.0, // 16
    6.0, // 17
    6.5, // 18
    5.5, // 19
    4.5, // 20
    3.5, // 21
    2.8, // 22
    2.2, // 23
  ];
  const sampleCounts = [5,5,5,5,5,6,8,10,15,18,20,20,18,16,14,12,12,14,15,12,10,8,6,5];
  await prisma.energyCurvePoint.createMany({
    data: hourlyEnergy.map((avg, hour) => ({
      userId: user.id,
      hour,
      average: avg,
      sampleCount: sampleCounts[hour],
    })),
  });
  console.log(`  ✓ EnergyCurvePoints created: 24 rows`);

  // 4. BreakStats — 4 types × 2 durations
  const breakStatData = [
    { breakType: "rest",       durationMinutes: 10, averageRestore: 1.5, sampleCount: 12 },
    { breakType: "rest",       durationMinutes: 20, averageRestore: 2.5, sampleCount: 8  },
    { breakType: "walk",       durationMinutes: 10, averageRestore: 2.0, sampleCount: 10 },
    { breakType: "walk",       durationMinutes: 20, averageRestore: 3.0, sampleCount: 7  },
    { breakType: "snack",      durationMinutes: 10, averageRestore: 1.8, sampleCount: 9  },
    { breakType: "snack",      durationMinutes: 20, averageRestore: 2.2, sampleCount: 5  },
    { breakType: "power_nap",  durationMinutes: 10, averageRestore: 1.2, sampleCount: 3  },
    { breakType: "power_nap",  durationMinutes: 20, averageRestore: 3.5, sampleCount: 6  },
  ];
  await prisma.breakStat.createMany({
    data: breakStatData.map((b) => ({ ...b, userId: user.id })),
  });
  console.log(`  ✓ BreakStats created: ${breakStatData.length} rows`);

  // 5. Tasks for today
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const yesterdayMidnight = new Date(todayMidnight);
  yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);

  const task1 = await prisma.task.create({
    data: {
      userId: user.id,
      title: "Study Operating Systems — Chapter 4",
      type: TaskType.STUDY,
      durationMinutes: 90,
      estimatedEnergy: 7,
      adjustedEnergy: 7 * 1.3,
      priority: Priority.HIGH,
      deadline: new Date(todayMidnight.getTime() + 18 * 60 * 60 * 1000), // 6 PM today
      status: TaskStatus.COMPLETED,
      date: todayMidnight,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      userId: user.id,
      title: "Reply to lab report emails",
      type: TaskType.ADMIN,
      durationMinutes: 30,
      estimatedEnergy: 3,
      adjustedEnergy: 3 * 0.9,
      priority: Priority.MEDIUM,
      status: TaskStatus.COMPLETED,
      date: todayMidnight,
    },
  });

  const task3 = await prisma.task.create({
    data: {
      userId: user.id,
      title: "Work on project frontend",
      type: TaskType.DEEP_WORK,
      durationMinutes: 120,
      estimatedEnergy: 8,
      adjustedEnergy: 8 * 1.2,
      priority: Priority.HIGH,
      status: TaskStatus.PENDING,
      date: todayMidnight,
    },
  });
  console.log(`  ✓ Tasks created: 3 rows`);

  // 6. EnergyCheckins
  const todayAt = (h: number, m = 0) => new Date(todayMidnight.getTime() + (h * 60 + m) * 60 * 1000);
  const yesterdayAt = (h: number, m = 0) => new Date(yesterdayMidnight.getTime() + (h * 60 + m) * 60 * 1000);

  await prisma.energyCheckin.createMany({
    data: [
      {
        userId: user.id,
        level: 7,
        context: CheckinContext.DAILY_START,
        timestamp: yesterdayAt(8, 0),
      },
      {
        userId: user.id,
        level: 5,
        hardnessRating: 7,
        context: CheckinContext.POST_TASK,
        taskId: task1.id,
        timestamp: yesterdayAt(11, 30),
      },
      {
        userId: user.id,
        level: 8,
        context: CheckinContext.DAILY_START,
        timestamp: todayAt(8, 0),
      },
      {
        userId: user.id,
        level: 6,
        hardnessRating: 5,
        context: CheckinContext.POST_TASK,
        taskId: task2.id,
        timestamp: todayAt(9, 30),
      },
      {
        userId: user.id,
        level: 5,
        hardnessRating: 8,
        context: CheckinContext.POST_TASK,
        taskId: task1.id,
        timestamp: todayAt(11, 30),
      },
    ],
  });
  console.log(`  ✓ EnergyCheckins created: 5 rows`);

  // 7. ScheduleBlocks for today
  const block1 = await prisma.scheduleBlock.create({
    data: {
      userId: user.id,
      taskId: task1.id,
      date: todayMidnight,
      startTime: todayAt(9, 0),
      endTime: todayAt(10, 30),
      kind: BlockKind.TASK,
      status: BlockStatus.COMPLETED,
    },
  });

  const block2 = await prisma.scheduleBlock.create({
    data: {
      userId: user.id,
      taskId: task3.id,
      date: todayMidnight,
      startTime: todayAt(14, 0),
      endTime: todayAt(16, 0),
      kind: BlockKind.TASK,
      status: BlockStatus.SCHEDULED,
    },
  });
  console.log(`  ✓ ScheduleBlocks created: 2 rows`);

  // 8. RescheduleLogs
  await prisma.rescheduleLog.createMany({
    data: [
      {
        userId: user.id,
        blockId: block1.id,
        oldStart: todayAt(11, 0),
        newStart: todayAt(9, 0),
        reason: "Moved 'Study OS' earlier because your peak energy (8/10) matches in the 9 AM slot better than 11 AM.",
      },
      {
        userId: user.id,
        blockId: block2.id,
        oldStart: todayAt(13, 0),
        newStart: todayAt(14, 0),
        reason: "Inserted a 30-minute break after 'Admin emails' because your energy dropped to 5 and 'Deep Work' needs ~8. Pushed project work to 2 PM.",
      },
      {
        userId: user.id,
        blockId: block2.id,
        oldStart: todayAt(15, 0),
        newStart: todayAt(14, 0),
        reason: "Moved 'Work on project frontend' from 3 PM to 2 PM because your energy recovered to 6 after the break, and the 3 PM slot predicted to drop to 4.",
      },
    ],
  });
  console.log(`  ✓ RescheduleLogs created: 3 rows`);

  console.log("\n✅ Seed complete!");
  console.log(`   User:             ${user.email}`);
  console.log(`   Tasks:            3`);
  console.log(`   ScheduleBlocks:   2`);
  console.log(`   EnergyCheckins:   5`);
  console.log(`   TaskTypeStats:    7`);
  console.log(`   EnergyCurvePoints:24`);
  console.log(`   BreakStats:       8`);
  console.log(`   RescheduleLogs:   3`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
