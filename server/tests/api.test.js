import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

// Set env BEFORE importing the app, because app.js reads CLIENT_URL when it loads
process.env.JWT_SECRET = "test-secret";
process.env.CLIENT_URL = "http://localhost:5173";
const { default: app } = await import("../src/app.js");

let mongod;
before(async () => {
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 120000 } });
  await mongoose.connect(mongod.getUri());
}, { timeout: 180000 });

after(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop(); // skip if it never started
});

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const signUp = async (email) => {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: "Test User", email, password: "password123" });
  return res.body.token;
};
const todayUTC = () => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());

test("auth: register, duplicate, login, me", async () => {
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ name: "Arya", email: "a@test.com", password: "password123" });
  assert.equal(reg.status, 201);
  assert.ok(reg.body.token);
  assert.equal(reg.body.user.passwordHash, undefined); // the hash is never returned

  const dup = await request(app)
    .post("/api/auth/register")
    .send({ name: "Arya", email: "a@test.com", password: "password123" });
  assert.equal(dup.status, 409);

  const bad = await request(app).post("/api/auth/login").send({ email: "a@test.com", password: "wrong-password" });
  assert.equal(bad.status, 401);

  const ok = await request(app).post("/api/auth/login").send({ email: "a@test.com", password: "password123" });
  assert.equal(ok.status, 200);

  const me = await request(app).get("/api/auth/me").set(bearer(ok.body.token));
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, "a@test.com");
});

test("auth: validation and missing token", async () => {
  const short = await request(app)
    .post("/api/auth/register")
    .send({ name: "X Y", email: "x@test.com", password: "abc" });
  assert.equal(short.status, 400);

  assert.equal((await request(app).get("/api/auth/me")).status, 401);
  assert.equal((await request(app).get("/api/hydration")).status, 401);
});

test("hydration: validation, totals and ownership", async () => {
  const alice = await signUp("alice@test.com");
  const bob = await signUp("bob@test.com");

  const bad = await request(app).post("/api/hydration").set(bearer(alice)).send({ amountMl: "lots" });
  assert.equal(bad.status, 400);

  const drink = await request(app).post("/api/hydration").set(bearer(alice)).send({ amountMl: 250 });
  assert.equal(drink.status, 201);

  const list = await request(app).get("/api/hydration").set(bearer(alice));
  assert.equal(list.body.totalMl, 250);

  // Bob must not be able to delete Alice's entry
  const stolen = await request(app).delete(`/api/hydration/${drink.body._id}`).set(bearer(bob));
  assert.equal(stolen.status, 404);

  const own = await request(app).delete(`/api/hydration/${drink.body._id}`).set(bearer(alice));
  assert.equal(own.status, 200);
});

test("screen time: $max for app/browser, $set for manual, combined total", async () => {
  const token = await signUp("screen@test.com");
  const d = todayUTC();
  const put = (path, body) => request(app).put(`/api/screentime/${d}${path}`).set(bearer(token)).send(body);

  assert.equal((await put("", { totalMinutes: 30 })).body.totalMinutes, 30);
  assert.equal((await put("", { totalMinutes: 10 })).body.totalMinutes, 30); // never goes down

  await put("/source", { source: "browser", minutes: 50 });
  await put("/source", { source: "manual", minutes: 20 });

  // total = max(app, browser) + manual = max(30, 50) + 20
  let weekly = await request(app).get("/api/analytics/weekly?tz=UTC").set(bearer(token));
  assert.equal(weekly.body.daily.at(-1).screenMinutes, 70);

  await put("/source", { source: "browser", minutes: 10 }); // ignored by $max
  await put("/source", { source: "manual", minutes: 5 });   // manual can be corrected down
  weekly = await request(app).get("/api/analytics/weekly?tz=UTC").set(bearer(token));
  assert.equal(weekly.body.daily.at(-1).screenMinutes, 55);

  assert.equal((await put("/source", { source: "radio", minutes: 5 })).status, 400);
  assert.equal(
    (await request(app).put("/api/screentime/not-a-date").set(bearer(token)).send({ totalMinutes: 5 })).status,
    400
  );
});

test("analytics: weekly shape and insights", async () => {
  const token = await signUp("stats@test.com");
  await request(app).post("/api/hydration").set(bearer(token)).send({ amountMl: 500 });

  const weekly = await request(app).get("/api/analytics/weekly?tz=UTC").set(bearer(token));
  assert.equal(weekly.status, 200);
  assert.equal(weekly.body.daily.length, 7);
  assert.equal(weekly.body.daily.at(-1).waterMl, 500);

  const ins = await request(app).get("/api/analytics/insights?tz=UTC").set(bearer(token));
  assert.equal(ins.status, 200);
  assert.ok(ins.body.score >= 0 && ins.body.score <= 100);
  assert.equal(ins.body.trend.length, 7);
  assert.equal(typeof ins.body.streaks.water.current, "number");
});