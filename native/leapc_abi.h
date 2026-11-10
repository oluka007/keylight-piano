/* Minimal declarations of the LeapC types Keylight's helper uses.
 *
 * Source of truth: Ultraleap's Apache-2.0 UnityPlugin binding (LeapC.cs, "Use subject to
 * the terms of the Apache License 2.0"), where every struct is Sequential with Pack = 1,
 * and the public LeapC API documentation. Nothing here is copied from the proprietary SDK
 * and the library is never linked: the helper loads the tester's own installed LeapC at
 * run time. Field order and widths below follow that binding exactly; the sizes are
 * asserted so a mistake fails the build instead of reading garbage.
 */
#ifndef KEYLIGHT_LEAPC_ABI_H
#define KEYLIGHT_LEAPC_ABI_H
#include <stdint.h>

#pragma pack(push, 1)
typedef struct { float x, y, z; } LEAP_VECTOR;
typedef struct { float x, y, z, w; } LEAP_QUATERNION;
typedef struct { LEAP_VECTOR prev_joint, next_joint; float width; LEAP_QUATERNION rotation; } LEAP_BONE;
typedef struct { int32_t finger_id; LEAP_BONE metacarpal, proximal, intermediate, distal; int32_t is_extended; } LEAP_DIGIT;
typedef struct {
  LEAP_VECTOR position, stabilized_position, velocity, normal;
  float width;
  LEAP_VECTOR direction;
  LEAP_QUATERNION orientation;
} LEAP_PALM;
typedef struct {
  uint32_t id, flags;
  uint32_t type;                 /* eLeapHandType: 0 = Left, 1 = Right */
  float confidence;
  uint64_t visible_time;
  float pinch_distance, grab_angle, pinch_strength, grab_strength;
  LEAP_PALM palm;
  LEAP_DIGIT thumb, index, middle, ring, pinky;
  LEAP_BONE arm;
} LEAP_HAND;
typedef struct { void *reserved; int64_t frame_id; int64_t timestamp; } LEAP_FRAME_HEADER;
typedef struct {
  LEAP_FRAME_HEADER info;
  int64_t tracking_id;
  uint32_t nHands;
  LEAP_HAND *pHands;
  float framerate;
} LEAP_TRACKING_EVENT;
typedef struct { uint32_t size; uint32_t type; void *eventStructPtr; uint32_t deviceID; } LEAP_CONNECTION_MESSAGE;
typedef struct { void *handle; uint32_t id; } LEAP_DEVICE_REF;
typedef struct { uint32_t flags; LEAP_DEVICE_REF device; uint32_t status; } LEAP_DEVICE_EVENT;
typedef struct { uint32_t size; uint32_t status; } LEAP_CONNECTION_INFO;
typedef struct {
  uint32_t size, status, caps, type, baseline, serial_length;
  char *serial;
  float h_fov, v_fov;
  uint32_t range;
  char firmware_version[16];
} LEAP_DEVICE_INFO;
#pragma pack(pop)

_Static_assert(sizeof(LEAP_BONE) == 44, "LEAP_BONE size");
_Static_assert(sizeof(LEAP_DIGIT) == 184, "LEAP_DIGIT size");
_Static_assert(sizeof(LEAP_PALM) == 80, "LEAP_PALM size");
_Static_assert(sizeof(LEAP_HAND) == 1084, "LEAP_HAND size");
_Static_assert(sizeof(LEAP_FRAME_HEADER) == 24, "LEAP_FRAME_HEADER size");
_Static_assert(sizeof(LEAP_TRACKING_EVENT) == 48, "LEAP_TRACKING_EVENT size");
_Static_assert(sizeof(LEAP_CONNECTION_MESSAGE) == 20, "LEAP_CONNECTION_MESSAGE size");
_Static_assert(sizeof(LEAP_DEVICE_EVENT) == 20, "LEAP_DEVICE_EVENT size");
_Static_assert(sizeof(LEAP_DEVICE_INFO) == 60, "LEAP_DEVICE_INFO size");

/* eLeapRS */
#define LEAP_RS_SUCCESS 0u
#define LEAP_RS_INSUFFICIENT_BUFFER 0xE2010003u
#define LEAP_RS_TIMEOUT 0xE2010004u
/* eLeapEventType */
#define LEAP_EVT_NONE 0u
#define LEAP_EVT_CONNECTION 1u
#define LEAP_EVT_CONNECTION_LOST 2u
#define LEAP_EVT_DEVICE 3u
#define LEAP_EVT_DEVICE_FAILURE 4u
#define LEAP_EVT_TRACKING 0x100u
#define LEAP_EVT_DEVICE_LOST 0x104u
/* eLeapConnectionStatus */
#define LEAP_CONN_NOT_RUNNING 0xE7030004u
/* eLeapPolicyFlag */
#define LEAP_POLICY_BACKGROUND_FRAMES 1ull

/* Function types, as in the LeapC API documentation / binding */
typedef uint32_t (*fn_CreateConnection)(const void *config, void **connection);
typedef uint32_t (*fn_OpenConnection)(void *connection);
typedef uint32_t (*fn_PollConnection)(void *connection, uint32_t timeout, LEAP_CONNECTION_MESSAGE *msg);
typedef uint32_t (*fn_GetConnectionInfo)(void *connection, LEAP_CONNECTION_INFO *info);
typedef uint32_t (*fn_OpenDevice)(LEAP_DEVICE_REF ref, void **device);
typedef uint32_t (*fn_GetDeviceInfo)(void *device, LEAP_DEVICE_INFO *info);
typedef void (*fn_CloseDevice)(void *device);
typedef uint32_t (*fn_SetPolicyFlags)(void *connection, uint64_t set, uint64_t clear);
typedef uint32_t (*fn_CloseConnection)(void *connection);
typedef void (*fn_DestroyConnection)(void *connection);
#endif
