# Uerti
Call anyone on your same network with free p2p video calls.

The app was programmed using React Native, which is a very new technology that allows your code to run natively on android and iOS devices. 

It uses a WebRTC module designed by https://github.com/oney.


# Usage
1. Open Uerti
2. Choose a room ID and touch the arrow
3. Wait for the other person to enter the same word
4. Done! now you're on a video call with the other person
5. Touch the X on any moment to end the call and close the app


# Compiling
1. Download the source code
2. Install dependencies with 'npm install'
3. Generate a sign key 
   keytool -genkey -v -keystore uerti.keystore -alias uerti -keyalg RSA -keysize 2048 -validity 10000
4. react-native bundle --platform android --dev false --entry-file index.android.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res/
5. cd android && ./gradlew assembleRelease
6. adb install -r ./app/build/outputs/apk/app-release-unsigned.apk


# Analysis
https://www.openhub.net/p/uerti


# License 
Copyright (c) 2016 Enzo Panettieri.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
