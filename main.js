'use strict';

import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  Image,
  TouchableHighlight,
  View,
  TextInput,
  ListView,
  BackAndroid,
} from 'react-native';

import RNRestart from 'react-native-restart'

import io from 'socket.io-client/socket.io';

const socket = io.connect('https://react-native-webrtc.herokuapp.com', {transports: ['websocket']});

import {
  RTCPeerConnection,
  RTCMediaStream,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStreamTrack,
  getUserMedia,
} from 'react-native-webrtc';

const configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

const pcPeers = {};
let localStream;

function getLocalStream(isFront, callback) {
  MediaStreamTrack.getSources(sourceInfos => {
    console.log(sourceInfos);
    let videoSourceId;
    for (const i = 0; i < sourceInfos.length; i++) {
      const sourceInfo = sourceInfos[i];
      if(sourceInfo.kind == "video" && sourceInfo.facing == (isFront ? "front" : "back")) {
        videoSourceId = sourceInfo.id;
      }
    }
    getUserMedia({
      "audio": true,
      "video": {
        optional: [{sourceId: videoSourceId}]
      }
    }, function (stream) {
      console.log('dddd', stream);
      callback(stream);
    }, logError);
  });
}

function join(roomID) {
  socket.emit('join', roomID, function(socketIds){
    console.log('join', socketIds);
    for (const i in socketIds) {
      const socketId = socketIds[i];
      createPC(socketId, true);
    }
  });
}

function createPC(socketId, isOffer) {
  const pc = new RTCPeerConnection(configuration);
  pcPeers[socketId] = pc;

  pc.onicecandidate = function (event) {
    console.log('onicecandidate', event.candidate);
    if (event.candidate) {
      socket.emit('exchange', {'to': socketId, 'candidate': event.candidate });
    }
  };

  function createOffer() {
    pc.createOffer(function(desc) {
      console.log('createOffer', desc);
      pc.setLocalDescription(desc, function () {
        console.log('setLocalDescription', pc.localDescription);
        socket.emit('exchange', {'to': socketId, 'sdp': pc.localDescription });
      }, logError);
    }, logError);
  }

  pc.onnegotiationneeded = function () {
    console.log('onnegotiationneeded');
    if (isOffer) {
      createOffer();
    }
  }

  pc.oniceconnectionstatechange = function(event) {
    console.log('oniceconnectionstatechange', event.target.iceConnectionState);
    if (event.target.iceConnectionState === 'completed') {
      setTimeout(() => {
        getStats();
      }, 1000);
    }
    if (event.target.iceConnectionState === 'connected') {
      createDataChannel();
    }
  };
  pc.onsignalingstatechange = function(event) {
    console.log('onsignalingstatechange', event.target.signalingState);
  };

  pc.onaddstream = function (event) {
    console.log('onaddstream', event.stream);
    container.setState({info: ''});

    const remoteList = container.state.remoteList;
    remoteList[socketId] = event.stream.toURL();
    container.setState({ remoteList: remoteList });
  };
  pc.onremovestream = function (event) {
    console.log('onremovestream', event.stream);
  };

  pc.addStream(localStream);
  function createDataChannel() {
    if (pc.textDataChannel) {
      return;
    }
    const dataChannel = pc.createDataChannel("text");

    dataChannel.onerror = function (error) {
      console.log("dataChannel.onerror", error);
    };

    dataChannel.onmessage = function (event) {
      console.log("dataChannel.onmessage:", event.data);
      container.receiveTextData({user: socketId, message: event.data});
    };

    dataChannel.onopen = function () {
      console.log('dataChannel.onopen');
      container.setState({textRoomConnected: true});
    };

    dataChannel.onclose = function () {
      console.log("dataChannel.onclose");
    };

    pc.textDataChannel = dataChannel;
  }
  return pc;
}

function exchange(data) {
  const fromId = data.from;
  let pc;
  if (fromId in pcPeers) {
    pc = pcPeers[fromId];
  } else {
    pc = createPC(fromId, false);
  }

  if (data.sdp) {
    console.log('exchange sdp', data);
    pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
      if (pc.remoteDescription.type == "offer")
        pc.createAnswer(function(desc) {
          console.log('createAnswer', desc);
          pc.setLocalDescription(desc, function () {
            console.log('setLocalDescription', pc.localDescription);
            socket.emit('exchange', {'to': fromId, 'sdp': pc.localDescription });
          }, logError);
        }, logError);
    }, logError);
  } else {
    console.log('exchange candidate', data);
    pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
}

function leave(socketId) {
  console.log('leave', socketId);
  const pc = pcPeers[socketId];
  const viewIndex = pc.viewIndex;
  pc.close();
  delete pcPeers[socketId];

  const remoteList = container.state.remoteList;
  delete remoteList[socketId]
  container.setState({ remoteList: remoteList });
  container.setState({info: 'The other user left'});
}

socket.on('exchange', function(data){
  exchange(data);
});
socket.on('leave', function(socketId){
  leave(socketId);
});

socket.on('connect', function(data) {
  console.log('connect');
  getLocalStream(true, function(stream) {
    localStream = stream;
    container.setState({selfViewSrc: stream.toURL()});
    container.setState({status: 'ready', info: 'Choose a room ID'});
  });
});

function logError(error) {
  console.log("logError", error);
}

function mapHash(hash, func) {
  const array = [];
  for (const key in hash) {
    const obj = hash[key];
    array.push(func(obj, key));
  }
  return array;
}

function getStats() {
  const pc = pcPeers[Object.keys(pcPeers)[0]];
  if (pc.getRemoteStreams()[0] && pc.getRemoteStreams()[0].getAudioTracks()[0]) {
    const track = pc.getRemoteStreams()[0].getAudioTracks()[0];
    console.log('track', track);
    pc.getStats(track, function(report) {
      console.log('getStats report', report);
    }, logError);
  }
}

let container;

let backgroundImage = require('./img/backgroundLogin.jpg');

const uerti = React.createClass({
  getInitialState: function() {
    this.ds = new ListView.DataSource({rowHasChanged: (r1, r2) => true});
    return {
      info: '',
      status: 'init',
      roomID: '',
      isFront: true,
      selfViewSrc: null,
      remoteList: {},
      textRoomConnected: false,
      textRoomData: [],
      textRoomValue: '',
    };
  },
  componentDidMount: function() {
    container = this;
  },
  _press(event) {
    this.refs.roomID.blur();
    this.setState({status: 'connect', info: 'Waiting for another user...'});
    join(this.state.roomID);
    backgroundImage = require('./img/backgroundOnCall.jpg');
  },
  _switchVideoType() {
    const isFront = !this.state.isFront;
    this.setState({isFront});
    getLocalStream(isFront, function(stream) {
      if (localStream) {
        for (const id in pcPeers) {
          const pc = pcPeers[id];
          pc && pc.removeStream(localStream);
        }
        localStream.release();
      }
      localStream = stream;
      container.setState({selfViewSrc: stream.toURL()});

      for (const id in pcPeers) {
        const pc = pcPeers[id];
        pc && pc.addStream(localStream);
      }
    });
  },
  receiveTextData(data) {
    const textRoomData = this.state.textRoomData.slice();
    textRoomData.push(data);
    this.setState({textRoomData, textRoomValue: ''});
  },
  _textRoomPress() {
    if (!this.state.textRoomValue) {
      return
    }
    const textRoomData = this.state.textRoomData.slice();
    textRoomData.push({user: 'Me', message: this.state.textRoomValue});
    for (const key in pcPeers) {
      const pc = pcPeers[key];
      pc.textDataChannel.send(this.state.textRoomValue);
    }
    this.setState({textRoomData, textRoomValue: ''});
  },
  _renderTextRoom(){
    return (
      <View style={styles.listViewContainer}>
        <ListView
          dataSource={this.ds.cloneWithRows(this.state.textRoomData)}
          renderRow={rowData => <Text>{`${rowData.user}: ${rowData.message}`}</Text>}
          />
        <TextInput
          style={{width: 200, height: 30, borderColor: 'gray', borderWidth: 1}}
          onChangeText={value => this.setState({textRoomValue: value})}
          value={this.state.textRoomValue}
        />
        <TouchableHighlight
          onPress={this._textRoomPress}>
          <Text>Send</Text>
        </TouchableHighlight>
      </View>
    );
  },
  _restartApp(){
    if(this.state.status != 'ready'){
      socket.disconnect();
      BackAndroid.exitApp();
    }
  },
  render() {
    return (
      <Image source={backgroundImage}  style={styles.container}>
        <View style={styles.nameAndEnterRoom}>
          {this.state.status == 'init' ?
            <Image source={require('./img/logo.png')}  style={styles.logo}/> : null
          }
          {this.state.textRoomConnected && this._renderTextRoom()}
          {this.state.status == 'ready' ?
            (<View>
              <View style={{alignItems: 'center'}}>
                <Image source={require('./img/logo.png')}  style={styles.logo}/>
                {this.state.info != '' ?
                  (<Text style={styles.status}>
                    {this.state.info}
                   </Text>) : null
                }
                <TextInput
                  ref='roomID'
                  autoCorrect={false}
                  style={styles.textInput}
                  onChangeText={(text) => this.setState({roomID: text})}
                  value={this.state.roomID}
                  placeholder='#roomID'
                  placeholderTextColor='#BDBDBD'
                />
                <RTCView streamURL={this.state.selfViewSrc} style={styles.myCameraLogin}/>
                <TouchableHighlight
                  style={styles.button}
                  onPress={this._press}>
                  <Image source={require('./img/buttonEnter.png')}  style={styles.buttonImage}/>
                </TouchableHighlight>
              </View>
            </View>) : null
          }
        </View>

        <View style={styles.cameras}>
          {
            mapHash(this.state.remoteList, function(remote, index) {
              return <RTCView key={index} streamURL={remote} style={styles.otherCameraOnCall}/>
            })
          }
        {this.state.status == 'connect' ?
          (<View style={{alignItems: 'center'}}>
            {this.state.info != '' ?
              (<Text style={styles.status}>
                {this.state.info}
               </Text>) : null
            }
            <RTCView streamURL={this.state.selfViewSrc} style={styles.myCameraOnCall}/>
            <TouchableHighlight
	           style={styles.button}
             onPress={this._restartApp}>
             <Image source={require('./img/buttonLeave.png')}  style={styles.buttonImage}/>
            </TouchableHighlight>
          </View>) : null
        }
        </View>
      </Image>
    );
  }
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: null,
    height: null,
  },
  logo: {
    width: 125,
    height: 80,
    justifyContent: 'center',
    resizeMode: 'stretch',
    marginBottom: 20,
    marginTop: 30,
  },
  status: {
    fontSize: 21,
    textAlign: 'center',
    color: '#FFFFFF',
    marginTop: 40,
  },
  textInput: {
    width: 200,
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 17,
    marginTop: 10,
    marginBottom: 10,
  },
  myCameraLogin: {
    width: 170,
    height: 120,
    marginTop: 20,
  },
  myCameraOnCall: {
    width: 170,
    height: 120,
    marginTop: 20,
  },
  otherCameraOnCall: {
    width: 335,
    height: 330,
  },
  button: {
    height: 60,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  buttonImage: {
    height: 60,
    width: 60,
  },
  nameAndEnterRoom: {
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cameras: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  listViewContainer: {
    height: 150,
  },
  centered: {
    alignItems: 'center',
  },
});

AppRegistry.registerComponent('uerti', () => uerti);
