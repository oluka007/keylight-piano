/* Keylight's Ultraleap-compatible hand tracking helper (experimental).
 *
 * Loads the tester's own, already installed LeapC library at run time (nothing proprietary
 * is linked or shipped), connects to the Ultraleap tracking service and prints one JSON
 * object per line on stdout for Keylight to read. It never requests camera images, never
 * prints device serial numbers, library paths or user names, and exits when its output
 * pipe closes. Whether a ROLI Airwave is visible to that service is exactly what this
 * helper lets a tester find out; nothing here assumes it is.
 *
 *   keylight-leap-helper            stream until killed
 *   keylight-leap-helper --abi      print the struct sizes this build expects, then exit
 *
 * KEYLIGHT_LEAPC_PATH (test fixture) and KEYLIGHT_LEAPC (absolute path, for testers who start
 * Keylight from Terminal) name a library to try first. On a failed search the helper reports
 * which system folders it tried and which Ultraleap/LeapC names it saw there: file and
 * folder names under /Applications and /Library only, never anything from a home folder.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <signal.h>
#include "leapc_abi.h"
#ifdef _WIN32
#include <windows.h>
#define LIB_OPEN(p) ((void *)LoadLibraryA(p))
#define LIB_SYM(h, n) ((void *)GetProcAddress((HMODULE)(h), n))
#define PAUSE_MS(ms) Sleep(ms)
#else
#include <dlfcn.h>
#include <unistd.h>
#define LIB_OPEN(p) dlopen((p), RTLD_NOW | RTLD_LOCAL)
#define LIB_SYM(h, n) dlsym((h), (n))
#define PAUSE_MS(ms) usleep((ms) * 1000)
#endif

static void emit_end(void) {
  if (fputc('\n', stdout) == EOF || fflush(stdout) == EOF) exit(0);   /* the reader is gone */
}
#define EMIT(...) do { printf(__VA_ARGS__); emit_end(); } while (0)

static void *g_lib;
static const char *g_label = "none";

/* ---- finding the library ------------------------------------------------------------
 * One size contract: a reported note is at most NOTE_MAX bytes and is dropped whole (never
 * cut) when it would be longer; the bridge applies the same limit. Names are at most
 * NAME_MAX_LEN plain characters, so a note built from system folders and one name fits. */
#define NOTE_MAX 240
#define NAME_MAX_LEN 64
#define MAX_DIRS 40
#define MAX_NOTES 16
#define MAX_ATTEMPTS 40
#define OVERRIDE_MAX 600

#ifdef _WIN32
static int try_win(const char *label, const char *path) {
  g_lib = LIB_OPEN(path);
  if (g_lib) { g_label = label; return 1; }
  return 0;
}
static int load_runtime(void) {
  const char *o = getenv("KEYLIGHT_LEAPC_PATH");
  if (o && *o && try_win("override", o)) return 1;
  o = getenv("KEYLIGHT_LEAPC");
  if (o && *o && try_win("override", o)) return 1;
  const char *pf = getenv("ProgramFiles");
  char p[600];
  if (pf && snprintf(p, sizeof p, "%s\\Ultraleap\\LeapSDK\\lib\\x64\\LeapC.dll", pf) < (int)sizeof p && try_win("program-files", p)) return 1;
  return try_win("system", "LeapC.dll");
}
static void emit_missing(void) { EMIT("{\"t\":\"runtime\",\"state\":\"missing\",\"tried\":[],\"seen\":[]}"); }
#else
#include <dirent.h>
#include <fcntl.h>
#include <limits.h>
#include <membership.h>
#include <sys/acl.h>
#include <sys/stat.h>

/* The two system roots a library may live under. A test build (compiled with
 * -DKEYLIGHT_TEST_ROOTS, never the shipped helper) may point them at temp folders. */
static const char *g_root_apps = "/Applications";
static const char *g_root_lib = "/Library";
#ifdef KEYLIGHT_TEST_ROOTS
static char g_root_apps_buf[PATH_MAX], g_root_lib_buf[PATH_MAX];
static void init_roots(void) {
  const char *a = getenv("KEYLIGHT_TEST_APPS_ROOT"), *l = getenv("KEYLIGHT_TEST_LIB_ROOT");
  if (a && *a && realpath(a, g_root_apps_buf)) g_root_apps = g_root_apps_buf;
  if (l && *l && realpath(l, g_root_lib_buf)) g_root_lib = g_root_lib_buf;
}
#else
static void init_roots(void) {}
#endif

static char g_dirs[MAX_DIRS][NOTE_MAX];
static int g_ndirs;
static char g_seen[MAX_NOTES][NOTE_MAX];
static int g_nseen;
static int g_attempts;

static int name_ok(const char *s) {   /* plain file-name characters only: also safe inside JSON */
  size_t n = strlen(s);
  if (!n || n > NAME_MAX_LEN) return 0;
  for (; *s; s++) if (!((*s >= '0' && *s <= '9') || (*s >= 'A' && *s <= 'Z') || (*s >= 'a' && *s <= 'z') || strchr(" ._-()+", *s))) return 0;
  return 1;
}
static int has_prefix(const char *s, const char *p) { return strncmp(s, p, strlen(p)) == 0; }
static int has_suffix(const char *s, const char *x) { size_t a = strlen(s), b = strlen(x); return a >= b && strcmp(s + a - b, x) == 0; }

static void note(const char *kind, const char *dir, const char *name) {
  char buf[NOTE_MAX];
  int r = dir ? snprintf(buf, sizeof buf, "%s:%s/%s", kind, dir, name) : snprintf(buf, sizeof buf, "%s:%s", kind, name);
  if (r < 0 || r >= (int)sizeof buf || g_nseen >= MAX_NOTES) return;   /* too long: dropped whole */
  for (int i = 0; i < g_nseen; i++) if (strcmp(g_seen[i], buf) == 0) return;
  memcpy(g_seen[g_nseen++], buf, (size_t)r + 1);
}

static int owner_ok(const struct stat *st) {
  return (st->st_uid == 0 || st->st_uid == geteuid()) && !(st->st_mode & (S_IWGRP | S_IWOTH));
}
static int under(const char *p, const char *root) { size_t n = strlen(root); return strncmp(p, root, n) == 0 && p[n] == '/'; }

/* An ACL entry that lets anyone but root or this user write, add, delete or change the item. */
static int acl_ok(const char *path) {
  acl_t acl = acl_get_file(path, ACL_TYPE_EXTENDED);
  if (!acl) return 1;                                     /* no ACL */
  static const acl_perm_t writes[] = { ACL_WRITE_DATA, ACL_ADD_FILE, ACL_APPEND_DATA, ACL_ADD_SUBDIRECTORY, ACL_DELETE,
    ACL_DELETE_CHILD, ACL_WRITE_ATTRIBUTES, ACL_WRITE_EXTATTRIBUTES, ACL_WRITE_SECURITY, ACL_CHANGE_OWNER };
  int ok = 1;
  acl_entry_t e;
  for (int which = ACL_FIRST_ENTRY; ok && acl_get_entry(acl, which, &e) == 0; which = ACL_NEXT_ENTRY) {
    acl_tag_t tag;
    acl_permset_t perms;
    if (acl_get_tag_type(e, &tag) != 0 || tag != ACL_EXTENDED_ALLOW || acl_get_permset(e, &perms) != 0) continue;
    int writes_any = 0;
    for (size_t i = 0; i < sizeof writes / sizeof writes[0]; i++) if (acl_get_perm_np(perms, writes[i]) == 1) writes_any = 1;
    if (!writes_any) continue;
    guid_t *who = (guid_t *)acl_get_qualifier(e);
    uid_t id = 0;
    int type = -1;
    if (!who || mbr_uuid_to_id((const unsigned char *)who, &id, &type) != 0 || type != ID_TYPE_UID || (id != 0 && id != geteuid())) ok = 0;
    if (who) acl_free(who);
  }
  acl_free(acl);
  return ok;
}
static int item_ok(const char *path, const struct stat *st) { return owner_ok(st) && acl_ok(path); }

/* 0: no such regular file. 1: trusted, canon holds the canonical path to load and *out its
 * stat. -1: exists but is not trusted: it resolves outside the two system roots, or it or a
 * folder between it and the root is owned by someone other than root or this user, is
 * group/world writable, or has an ACL granting write to anyone else. The root folder itself
 * (/Applications is root:admin 775) is only required to be owned by root or this user and
 * not world-writable: its expected group write is the one thing waived. */
static int vet(const char *path, char *canon, struct stat *out) {
  if (!realpath(path, canon)) return 0;
  struct stat st;
  if (stat(canon, &st) != 0 || !S_ISREG(st.st_mode)) return 0;
  const char *root = under(canon, g_root_apps) ? g_root_apps : under(canon, g_root_lib) ? g_root_lib : NULL;
  if (!root || !item_ok(canon, &st)) return -1;
  *out = st;
  char dir[PATH_MAX];
  strcpy(dir, canon);
  for (;;) {
    char *slash = strrchr(dir, '/');
    if (!slash || slash == dir) return -1;
    *slash = 0;
    if (stat(dir, &st) != 0 || !S_ISDIR(st.st_mode)) return -1;
    if (strcmp(dir, root) == 0) return ((st.st_uid == 0 || st.st_uid == geteuid()) && !(st.st_mode & S_IWOTH)) ? 1 : -1;
    if (!item_ok(dir, &st)) return -1;
  }
}

/* Vet, open the canonical path without following links and check the open file is the one
 * vetted, load that canonical path, then vet again and compare device/inode. Anything that
 * changed in between is unloaded and reported. A swap in the instant between the last check
 * and dyld's own open of the path cannot be closed from user space; the helper has no
 * special privileges, which is why this is a narrowed, not an eliminated, window. */
static int try_file(const char *label, const char *path, const char *name) {
  char canon[PATH_MAX], again[PATH_MAX];
  struct stat st, now, fst;
  int v = vet(path, canon, &st);
  if (v == 0 || g_attempts >= MAX_ATTEMPTS) return 0;   /* only real files use up an attempt */
  g_attempts++;
  if (v < 0) { note("untrusted", NULL, name); return 0; }
  int fd = open(canon, O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  if (fd < 0 || fstat(fd, &fst) != 0 || !S_ISREG(fst.st_mode) || fst.st_dev != st.st_dev || fst.st_ino != st.st_ino || !owner_ok(&fst)) {
    if (fd >= 0) close(fd);
    note("untrusted", NULL, name);
    return 0;
  }
  void *h = LIB_OPEN(canon);                             /* the verified canonical path */
  int same = h && vet(canon, again, &now) == 1 && strcmp(again, canon) == 0 && now.st_dev == fst.st_dev && now.st_ino == fst.st_ino;
  close(fd);
  if (h && !same) { dlclose(h); note("untrusted", NULL, "changed"); return 0; }
  if (h) { g_lib = h; g_label = label; return 1; }
  note("unloadable", NULL, name);                        /* there and trusted, but would not load */
  return 0;
}

/* One folder, one level deep: the two usual names, then any other libLeapC*.dylib in it. */
static int search_dir(const char *label, const char *dir) {
  static const char *const usual[] = { "libLeapC.dylib", "libLeapC.5.dylib" };
  if (strlen(dir) >= NOTE_MAX - NAME_MAX_LEN) return 0;
  for (int i = 0; i < g_ndirs; i++) if (strcmp(g_dirs[i], dir) == 0) return 0;   /* already searched */
  if (g_ndirs < MAX_DIRS) strcpy(g_dirs[g_ndirs++], dir);
  char p[PATH_MAX];
  for (int i = 0; i < 2; i++)
    if (snprintf(p, sizeof p, "%s/%s", dir, usual[i]) < (int)sizeof p && try_file(label, p, usual[i])) return 1;
  DIR *d = opendir(dir);
  if (!d) return 0;
  struct dirent *e;
  int looked = 0, hit = 0;
  while (!hit && (e = readdir(d)) != NULL && ++looked <= 200) {
    if (!has_prefix(e->d_name, "libLeapC") || !has_suffix(e->d_name, ".dylib") || !name_ok(e->d_name)) continue;
    note("lib", dir, e->d_name);
    if (strcmp(e->d_name, usual[0]) == 0 || strcmp(e->d_name, usual[1]) == 0) continue;
    if (snprintf(p, sizeof p, "%s/%s", dir, e->d_name) < (int)sizeof p) hit = try_file(label, p, e->d_name);
  }
  closedir(d);
  return hit;
}

static int try_override(const char *env) {
  const char *v = getenv(env);
  if (!v || !*v) return 0;
  if (v[0] != '/' || strlen(v) >= OVERRIDE_MAX) { note("override", NULL, "rejected"); return 0; }   /* never a cut-off or relative path */
  g_lib = LIB_OPEN(v);
  if (g_lib) { g_label = "override"; return 1; }
  return 0;
}

static int in_dir(const char *label, const char *fmt, const char *root, const char *sub) {
  char dir[PATH_MAX];
  if (snprintf(dir, sizeof dir, fmt, root, sub) >= (int)sizeof dir) return 0;
  return search_dir(label, dir);
}

static int load_runtime(void) {
  init_roots();
  if (try_override("KEYLIGHT_LEAPC_PATH") || try_override("KEYLIGHT_LEAPC")) return 1;
  /* the known install locations first */
  if (in_dir("service-app", "%s/%s", g_root_apps, "Ultraleap Hand Tracking Service.app/Contents/LeapSDK/lib")) return 1;
  static const char *const tracking[] = { "Contents/LeapSDK/lib", "Contents/Frameworks", "Contents/Resources" };
  for (int i = 0; i < 3; i++) {
    char sub[200];
    snprintf(sub, sizeof sub, "Ultraleap Hand Tracking.app/%s", tracking[i]);
    if (in_dir("tracking-app", "%s/%s", g_root_apps, sub)) return 1;
  }
  if (in_dir("library-support", "%s/%s", g_root_lib, "Application Support/Ultraleap/LeapSDK/lib")) return 1;
  /* then a bounded look around: /Applications entries named Ultraleap* or Leap*, one level */
  char names[8][NAME_MAX_LEN + 1];
  int napps = 0;
  DIR *d = opendir(g_root_apps);
  if (d) {
    struct dirent *e;
    int looked = 0;
    while ((e = readdir(d)) != NULL && ++looked <= 2000 && napps < 8) {
      if (!(has_prefix(e->d_name, "Ultraleap") || has_prefix(e->d_name, "Leap")) || !has_suffix(e->d_name, ".app") || !name_ok(e->d_name)) continue;
      strcpy(names[napps++], e->d_name);
    }
    closedir(d);
  }
  static const char *const subs[] = { "Contents/LeapSDK/lib", "Contents/Frameworks", "Contents/Resources/LeapSDK/lib", "Contents/MacOS" };
  for (int a = 0; a < napps; a++) {
    note("app", NULL, names[a]);
    for (int i = 0; i < 4; i++) {
      char sub[200];
      snprintf(sub, sizeof sub, "%s/%s", names[a], subs[i]);
      if (in_dir("app-scan", "%s/%s", g_root_apps, sub)) return 1;
    }
  }
  if (in_dir("library-scan", "%s/%s", g_root_lib, "Application Support/Ultraleap")) return 1;
  /* no bare-name dlopen: that would let the dynamic loader's search paths pick the file */
  return 0;
}

/* The report for a failed search: system folders tried, names seen. The override is never listed. */
static void emit_missing(void) {
  printf("{\"t\":\"runtime\",\"state\":\"missing\",\"tried\":[");
  for (int i = 0; i < g_ndirs; i++) printf("%s\"%s\"", i ? "," : "", g_dirs[i]);
  printf("],\"seen\":[");
  for (int i = 0; i < g_nseen; i++) printf("%s\"%s\"", i ? "," : "", g_seen[i]);
  printf("]}");
  emit_end();
}
#endif

static const char *device_class(uint32_t type) {
  switch (type) {
    case 0x0003: return "peripheral";
    case 0x1102: return "dragonfly";
    case 0x1201: return "nightcrawler";
    case 0x1202: return "rigel";
    case 0x1203: return "SIR170";
    case 0x1204: return "3Di";
    case 0x1206: return "LMC2";
    default: return "unknown";
  }
}

static int finite3(const LEAP_VECTOR *v) { return isfinite(v->x) && isfinite(v->y) && isfinite(v->z); }

static void emit_frame(const LEAP_TRACKING_EVENT *ev) {
  uint32_t n = ev->nHands > 4 ? 4 : ev->nHands;
  printf("{\"t\":\"frame\",\"ts\":%lld,\"fps\":%.1f,\"hands\":[", (long long)ev->info.timestamp,
         isfinite(ev->framerate) ? ev->framerate : 0.0);
  int first = 1;
  for (uint32_t i = 0; i < n && ev->pHands; i++) {
    const LEAP_HAND *h = &ev->pHands[i];
    const LEAP_DIGIT *d[5] = { &h->thumb, &h->index, &h->middle, &h->ring, &h->pinky };
    if (h->type > 1) continue;
    if (!first) putchar(',');
    first = 0;
    printf("{\"side\":\"%s\",\"conf\":%.3f,\"tips\":[", h->type == 0 ? "left" : "right",
           isfinite(h->confidence) ? h->confidence : 0.0);
    for (int f = 0; f < 5; f++) {
      const LEAP_VECTOR *tip = &d[f]->distal.next_joint;   /* the fingertip */
      if (f) putchar(',');
      if (finite3(tip)) printf("[%.2f,%.2f,%.2f]", tip->x, tip->y, tip->z); else printf("null");
    }
    printf("]}");
  }
  printf("]}");
  emit_end();
}

int main(int argc, char **argv) {
#ifndef _WIN32
  signal(SIGPIPE, SIG_IGN);
#endif
  setvbuf(stdout, NULL, _IOFBF, 1 << 16);
  if (argc > 1 && strcmp(argv[1], "--abi") == 0) {
    EMIT("{\"t\":\"abi\",\"hand\":%zu,\"digit\":%zu,\"bone\":%zu,\"trackingEvent\":%zu,\"message\":%zu,\"deviceInfo\":%zu}",
         sizeof(LEAP_HAND), sizeof(LEAP_DIGIT), sizeof(LEAP_BONE), sizeof(LEAP_TRACKING_EVENT),
         sizeof(LEAP_CONNECTION_MESSAGE), sizeof(LEAP_DEVICE_INFO));
    return 0;
  }
#ifdef _WIN32
  EMIT("{\"t\":\"hello\",\"helper\":1,\"os\":\"windows\"}");
#else
  EMIT("{\"t\":\"hello\",\"helper\":1,\"os\":\"mac\"}");
#endif
  if (!load_runtime()) { emit_missing(); return 3; }
  EMIT("{\"t\":\"runtime\",\"state\":\"loaded\",\"from\":\"%s\"}", g_label);

  fn_CreateConnection create = (fn_CreateConnection)LIB_SYM(g_lib, "LeapCreateConnection");
  fn_OpenConnection open_c = (fn_OpenConnection)LIB_SYM(g_lib, "LeapOpenConnection");
  fn_PollConnection poll = (fn_PollConnection)LIB_SYM(g_lib, "LeapPollConnection");
  fn_GetConnectionInfo conn_info = (fn_GetConnectionInfo)LIB_SYM(g_lib, "LeapGetConnectionInfo");
  fn_OpenDevice open_dev = (fn_OpenDevice)LIB_SYM(g_lib, "LeapOpenDevice");
  fn_GetDeviceInfo dev_info = (fn_GetDeviceInfo)LIB_SYM(g_lib, "LeapGetDeviceInfo");
  fn_CloseDevice close_dev = (fn_CloseDevice)LIB_SYM(g_lib, "LeapCloseDevice");
  fn_SetPolicyFlags policy = (fn_SetPolicyFlags)LIB_SYM(g_lib, "LeapSetPolicyFlags");
  if (!create || !open_c || !poll) { EMIT("{\"t\":\"runtime\",\"state\":\"incompatible\"}"); return 4; }

  void *conn = NULL;
  uint32_t rs = create(NULL, &conn);
  if (rs != LEAP_RS_SUCCESS || !conn) { EMIT("{\"t\":\"error\",\"stage\":\"create\",\"code\":%u}", rs); return 5; }
  rs = open_c(conn);
  if (rs != LEAP_RS_SUCCESS) { EMIT("{\"t\":\"error\",\"stage\":\"open\",\"code\":%u}", rs); return 5; }

  int service_up = 0, said_not_running = 0, quiet_polls = 0, abi_reported = 0;
  for (;;) {
    LEAP_CONNECTION_MESSAGE msg;
    memset(&msg, 0, sizeof msg);
    msg.size = sizeof msg;
    rs = poll(conn, 100, &msg);
    if (rs == LEAP_RS_TIMEOUT) {
      if (!service_up && ++quiet_polls >= 20 && conn_info) {   /* about 2 s without a connection event */
        LEAP_CONNECTION_INFO info = { sizeof info, 0 };
        if (conn_info(conn, &info) == LEAP_RS_SUCCESS && info.status == LEAP_CONN_NOT_RUNNING && !said_not_running) {
          said_not_running = 1;
          EMIT("{\"t\":\"service\",\"state\":\"not_running\"}");
        }
        quiet_polls = 0;
      }
      continue;
    }
    if (rs != LEAP_RS_SUCCESS) { EMIT("{\"t\":\"error\",\"stage\":\"poll\",\"code\":%u}", rs); PAUSE_MS(200); continue; }
    if (!abi_reported) {
      abi_reported = 1;
      EMIT("{\"t\":\"abi\",\"messageSize\":%u,\"expected\":%zu}", msg.size, sizeof msg);
    }
    switch (msg.type) {
      case LEAP_EVT_CONNECTION:
        service_up = 1; said_not_running = 0;
        EMIT("{\"t\":\"service\",\"state\":\"connected\"}");
        if (policy) policy(conn, LEAP_POLICY_BACKGROUND_FRAMES, 0);
        break;
      case LEAP_EVT_CONNECTION_LOST:
        service_up = 0;
        EMIT("{\"t\":\"service\",\"state\":\"lost\"}");
        break;
      case LEAP_EVT_DEVICE: {
        const LEAP_DEVICE_EVENT *de = (const LEAP_DEVICE_EVENT *)msg.eventStructPtr;
        uint32_t code = 0;
        int known = 0;
        if (de && open_dev && dev_info && close_dev) {
          void *dev = NULL;
          if (open_dev(de->device, &dev) == LEAP_RS_SUCCESS && dev) {
            LEAP_DEVICE_INFO info;
            memset(&info, 0, sizeof info);
            info.size = sizeof info;                     /* serial stays NULL: it is never read */
            uint32_t r = dev_info(dev, &info);
            if (r == LEAP_RS_SUCCESS || r == LEAP_RS_INSUFFICIENT_BUFFER) { code = info.type; known = 1; }
            close_dev(dev);
          }
        }
        EMIT("{\"t\":\"device\",\"state\":\"attached\",\"streaming\":%s,\"class\":\"%s\",\"typeCode\":%u,\"identified\":%s}",
             de && (de->status & 1u) ? "true" : "false", known ? device_class(code) : "unknown", code,
             known ? "true" : "false");
        break;
      }
      case LEAP_EVT_DEVICE_LOST: EMIT("{\"t\":\"device\",\"state\":\"lost\"}"); break;
      case LEAP_EVT_DEVICE_FAILURE: EMIT("{\"t\":\"device\",\"state\":\"failed\"}"); break;
      case LEAP_EVT_TRACKING:
        if (msg.eventStructPtr) emit_frame((const LEAP_TRACKING_EVENT *)msg.eventStructPtr);
        break;
      default: break;
    }
  }
}
