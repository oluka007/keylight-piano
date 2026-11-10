/* TEST FIXTURE ONLY: a stand-in for the LeapC shared library, written for Keylight's
 * tests. It exports the handful of C entry points the helper loads and replays a script:
 * a connection, a device, then the tracking frames found in KEYLIGHT_FAKE_FRAMES (records
 * of a uint32 hand count followed by that many raw LEAP_HAND structs, laid out by the
 * test independently of leapc_abi.h), then a connection loss. It proves the helper's
 * process, library loading, pointer handling and JSON output; it is not an Ultraleap
 * runtime and says nothing about any real device. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "leapc_abi.h"
#define EXPORT __attribute__((visibility("default")))

static FILE *frames;
static int step;
static LEAP_TRACKING_EVENT event;
static LEAP_HAND hands[4];
static LEAP_DEVICE_EVENT device_event;
static long long frame_index;

/* QA mode (KEYLIGHT_FAKE_POSE=file): endless frames at ~90 per second for one right hand.
 * The file holds "x finger y": the x position in millimetres of one fingertip, which finger
 * (1 thumb .. 5 little) it is, and its height y; the other fingertips sit 88 mm further along
 * KEYLIGHT_FAKE_LIFT_DIR (+1 or -1, the direction in which raising a finger changes Y). It is
 * re-read every frame so a script can move the "hand"
 * while the real app runs. Every frame the file <path>.ack is rewritten with the pose just
 * emitted and its frame number, so a script can wait for the change instead of sleeping. */
static int pose_frame(LEAP_TRACKING_EVENT *ev) {
  const char *path = getenv("KEYLIGHT_FAKE_POSE");
  if (!path) return 0;
  float x = 0, y = 22;
  int low = 2;
  const char *dir_env = getenv("KEYLIGHT_FAKE_LIFT_DIR");
  float dir = dir_env && atoi(dir_env) < 0 ? -1.0f : 1.0f;
  FILE *f = fopen(path, "r");
  if (f) { if (fscanf(f, "%f %d %f", &x, &low, &y) < 1) x = 0; fclose(f); }
  if (low < 1 || low > 5) low = 2;
  memset(hands, 0, sizeof hands);
  hands[0].type = 1; hands[0].confidence = 0.97f;
  LEAP_DIGIT *d[5] = { &hands[0].thumb, &hands[0].index, &hands[0].middle, &hands[0].ring, &hands[0].pinky };
  for (int i = 0; i < 5; i++) {
    d[i]->distal.next_joint.x = x + (float)(i - low + 1) * 25.0f;
    d[i]->distal.next_joint.y = i == low - 1 ? y : y + dir * 88.0f;
    d[i]->distal.next_joint.z = 5.0f;
  }
  memset(ev, 0, sizeof *ev);
  ev->info.frame_id = frame_index; ev->info.timestamp = 1000000 + frame_index * 11111;
  ev->nHands = 1; ev->pHands = hands; ev->framerate = 90.0f;
  char ack[700];
  snprintf(ack, sizeof ack, "%s.ack", path);
  FILE *a = fopen(ack, "w");
  if (a) { fprintf(a, "%g %d %g %lld", x, low, y, frame_index); fclose(a); }
  frame_index++;
  usleep(11000);
  return 1;
}

EXPORT uint32_t LeapCreateConnection(const void *config, void **connection) { (void)config; *connection = (void *)0x1; return 0; }
EXPORT uint32_t LeapOpenConnection(void *c) {
  (void)c;
  const char *path = getenv("KEYLIGHT_FAKE_FRAMES");
  if (path) frames = fopen(path, "rb");
  return 0;
}
EXPORT uint32_t LeapGetConnectionInfo(void *c, LEAP_CONNECTION_INFO *info) {
  (void)c;
  info->status = getenv("KEYLIGHT_FAKE_NOT_RUNNING") ? LEAP_CONN_NOT_RUNNING : 1;
  return 0;
}
EXPORT uint32_t LeapPollConnection(void *c, uint32_t timeout, LEAP_CONNECTION_MESSAGE *msg) {
  (void)c;
  if (getenv("KEYLIGHT_FAKE_NOT_RUNNING")) { usleep(timeout * 1000); return LEAP_RS_TIMEOUT; }
  memset(msg, 0, sizeof *msg);
  msg->size = sizeof *msg;
  if (step == 0) { step = 1; msg->type = LEAP_EVT_CONNECTION; return 0; }
  if (step == 1) {
    step = 2;
    device_event.flags = 0; device_event.device.handle = (void *)0x2; device_event.device.id = 7; device_event.status = 1;
    msg->type = LEAP_EVT_DEVICE; msg->eventStructPtr = &device_event; return 0;
  }
  if (step == 2 && pose_frame(&event)) { msg->type = LEAP_EVT_TRACKING; msg->eventStructPtr = &event; return 0; }
  if (step == 2) {
    uint32_t n = 0;
    if (frames && fread(&n, 4, 1, frames) == 1 && n <= 4) {
      if (n && fread(hands, sizeof(LEAP_HAND), n, frames) != n) n = 0;
      memset(&event, 0, sizeof event);
      event.info.frame_id = frame_index; event.info.timestamp = 1000000 + frame_index * 11111; frame_index++;
      event.nHands = n; event.pHands = hands; event.framerate = 90.0f;
      msg->type = LEAP_EVT_TRACKING; msg->eventStructPtr = &event; return 0;
    }
    step = 3; msg->type = LEAP_EVT_CONNECTION_LOST; return 0;
  }
  usleep(timeout * 1000);
  return LEAP_RS_TIMEOUT;
}
EXPORT uint32_t LeapOpenDevice(LEAP_DEVICE_REF ref, void **device) { (void)ref; *device = (void *)0x3; return 0; }
EXPORT uint32_t LeapGetDeviceInfo(void *device, LEAP_DEVICE_INFO *info) {
  (void)device;
  const char *t = getenv("KEYLIGHT_FAKE_DEVICE_TYPE");
  info->type = t ? (uint32_t)strtoul(t, NULL, 16) : 0x1203;
  info->serial_length = 12;       /* the helper must never ask for or print the serial */
  return LEAP_RS_INSUFFICIENT_BUFFER;
}
EXPORT void LeapCloseDevice(void *d) { (void)d; }
EXPORT uint32_t LeapSetPolicyFlags(void *c, uint64_t set, uint64_t clear) { (void)c; (void)set; (void)clear; return 0; }
EXPORT uint32_t LeapCloseConnection(void *c) { (void)c; return 0; }
EXPORT void LeapDestroyConnection(void *c) { (void)c; }
