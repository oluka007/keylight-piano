# Keylight Airwave Test: quick steps (Mac)

Thanks for testing. We don't know yet whether the Airwave can give Keylight finger
positions, and this build exists to find out. It is experimental and nothing is sent
anywhere; you send back one small text file.

You need: an Apple silicon Mac (macOS 13+) and your Airwave plugged in directly by USB.
Unplug any other Ultraleap or Leap Motion sensor while testing.

1. **Install Ultraleap's hand tracking software** (Gemini V5 or newer) from Ultraleap's
   website and approve any prompts it shows. Keylight doesn't install drivers or touch
   services. ROLI Airwave Control can stay installed.
2. **Unzip it and open Keylight Airwave Test.** It isn't notarized by Apple, so macOS will
   block it the first time. Try right-click, Open. If there is no Open button, go to
   System Settings, Privacy & Security, scroll down and press **Open Anyway**, then open
   it again. It keeps its own settings and doesn't touch a normal Keylight install.
3. **Settings, Airwave finger tracking:** set *Finger source* to *Airwave sensor
   (experimental)* and press **Connect**. Hold your hands above the Airwave.
4. **Read Status.** The message says what to do next. If it says it can't find the tracking
   software or a device, don't worry: go to step 7 anyway, that answer is useful too.
5. **If it says "Receiving fingertips":** open a song (Twinkle is fine), then press
   **Calibrate keys** and use your **right index finger** for all three steps:
   press a key near the low end, press a key near the high end, then lift that finger
   about 5 cm up and hold still for a moment.
6. **Play a few notes.** A numbered badge should appear over the key under each fingertip,
   and the line under the keys names the finger you used. Note whether it looks right.
7. **Press "Export test report"** and send the file back. It holds counts and the device
   type only: no video, finger coordinates, serial numbers, file paths or songs.

**If it says the tracking software was not found** (even though Ultraleap Hand Tracking is
installed): open Terminal, run these two commands and send us the text they print.

    ls /Applications | grep -i -E 'ultraleap|leap'
    find /Applications /Library -name 'libLeapC*' 2>/dev/null

They only list file names; nothing is changed. The exported report also has an "Ultraleap
runtime search" line showing which system folders Keylight looked in. If you can start
Keylight from Terminal, `KEYLIGHT_LEAPC=/full/path/to/libLeapC.dylib` (the path the
second command printed) tells it exactly where the library is.

Also tell us: what the Status line said, and whether the badges followed your fingers.
