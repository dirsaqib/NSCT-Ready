# NSCT Lab Server (offline tests)

Runs a department lab test with the internet switched off. One PC in the lab is the server. Students open it in a browser over the lab network.

## What you need

- One lab PC as the server, with **Node.js 18 or newer** installed. Keep the Node.js installer on a USB drive for labs without internet.
- All student PCs on the same lab network (switch or Wi-Fi) as the server PC.
- The test package (`.nsctlab`) and its passphrase, from NSCT Ready: **Lab tests**, open the test, **Download package**.

## On exam day

1. Copy this `lab-server` folder and the `.nsctlab` file to the server PC.
2. Double-click `start-lab-server.bat` (Windows) or run `./start-lab-server.sh` (Linux or Mac). Keep the window open.
3. On the server PC open `http://localhost:8080/invigilator`. Choose the package file and type the passphrase.
4. Switch off the internet for the lab. Leave the lab network on.
5. Write the student address (for example `http://192.168.1.10:8080`) and the room code on the board, or press **Show on projector**.
6. Press **Start exam**. Students sign in with their roll number and the room code.
7. Watch the live list. **Move PC** lets a student continue on another PC. **Add time** extends for everyone.
8. Press **End exam**, then **Export results**. Keep the `.nsctresults` file on a USB drive.
9. Back online, open the test on NSCT Ready and upload the results file.

## Safety

- The package is encrypted (AES-256-GCM, key from the passphrase). Without the passphrase it cannot be read.
- Answers are saved on the server PC after every change, in the `data` folder. If the PC restarts, run the start file again and type the passphrase. Nothing is lost.
- The results file is signed. NSCT Ready rejects it if anything is changed, and marks every answer again itself.
- Students cannot sign in twice at the same time with one roll number. Copy and paste are blocked, and leaving the window or full screen is recorded.
- Windows Firewall may ask to allow Node.js the first time. Allow it on **Private networks**.

## Coding questions

Offline tests support JavaScript coding questions. Students read input with `require("fs").readFileSync(0, "utf8")` and print the answer with `console.log`, the same as on NSCT Ready.

## After the test

Export the results, upload them, then delete the `data` folder before the next test.
