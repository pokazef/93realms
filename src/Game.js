'use strict';

//

var chat=false;
var PVP=true;
var minlevel=3;
var happyHour=1;

//

const Util = require('./Util');
const { itemDb, playerDb, roomDb, storeDb, enemyTpDb, enemyDb } =
  require('./Databases');
const ConnectionHandler = require('./ConnectionHandler');
const { Attribute, PlayerRank, ItemType, Direction, RoomType } =
  require('./Attributes');
const Player = require('./Player');
const Train = require('./Train');
const { cc } = require('./Telnet');

const xss = require('xss');

const tostring = Util.tostring;
const random = Util.randomInt;

let isRunning = false;

const timer = Util.createTimer().init();

// Game Handler class
class Game extends ConnectionHandler {

  static isRunning() {
    return isRunning;
  }

  static getTimer() {
    return timer;
  }

  static setIsRunning(bool) {
    isRunning = bool;
  }

  constructor(connection, player) {
    super(connection);
    this.player = player;
  }

  enter() {
    this.lastCommand = "";
    this.qState = -1; // ziad
    this.qWord = -1; // word
    this.lDir = 0; 
    const p = this.player;
    p.active = true;
    p.loggedIn = true;
    p.nextAttackTime = 0;
    p.lastMessage = "";
    // p.room is initially a room id when Player object
    // first initialized -- so converting to actual
    // room object here
    if (!isNaN(p.room)) p.room = roomDb.findById(p.room);
    p.room.addPlayer(p);

    var msg = "<bold><green>" + p.name + " has entered the realm.</green></bold>";
    if (p.level >= minlevel)
      Game.sendGame(msg);
    else
      Game.sendRoom(msg, p.room);

    if (p.newbie) this.goToTrain();
    else p.sendString(Game.printRoom(p.room));
  }

  handle(data) {

    const parseWord = Util.parseWord;
    const removeWord = Util.removeWord;
    const p = this.player;

    //sanitize
    data = xss(data);
    if (data=="") {return};
    if (data==undefined) {return};

    // check if the player wants to repeat a command
    if (data === '/') data = this.lastcommand || 'look';
    else this.lastcommand = data; // if not, record the command.

    // get the first word and lowercase it.
    const firstWord = parseWord(data, 0).toLowerCase();

    // happy hour
    happyHour = 1;
    const hour = new Date().getHours(); 
    if (hour>17&&hour<20) { happyHour=2; };

    // ------------------------------------------------------------------------
    //  REGULAR access commands
    // ------------------------------------------------------------------------

    if(chat){
      if (firstWord === "chat" || firstWord === ':') {
        const text = removeWord(data, 0);
        Game.sendGame(
          `<white><bold>${p.name} chats: ${text}</bold></white>`);
        return;
      }
    }

    // ziad money
    if (this.qState != -1){ 
      var deta = data.toLowerCase();
      if (deta == 'y' || deta == 'yes'){
        p.money -= this.qState;
        this.qState = -1;
        p.sendString('<green>Purchase successful</green>');
        this.move(this.lDir, true);
        return;
      }else if (deta == 'n' || deta == 'no'){
        this.qState = -1;
        p.sendString('<red>Purchase canceled</red>');
        return;
      }else{
        this.qState = -1;
        p.sendString('<red>Purchase canceled</red>');
      } 
    }

    // word
    if (this.qWord != -1){ 
      var deta = data.toLowerCase();
      if (deta == this.qWord){
        this.qWord = -1;
        p.sendString('<green>You can pass.</green>');
        this.move(this.lDir, true);
        return;
      }else{
        this.qWord = -1;
        p.sendString('<red>That does not seem to work.</red>');
      } 
    }

    // CONDITION
    try {
      if (roomDb.findById(p.room.id).condition!=undefined) {
        var cWorking=false;
        for (var j = 0; j < roomDb.findById(p.room.id).condition.length; j++) {

          var cCond = roomDb.findById(p.room.id).condition[j].IF;
          var cThen = roomDb.findById(p.room.id).condition[j].THEN;

          if(eval(cCond)){eval(cThen);cWorking=true;}       
        };
        if (cWorking) {return};
      };
    }
    catch(error) {
      console.error(error);
    }

    if (firstWord === "get" || firstWord === "take" || firstWord === "g") {
      this.getItem(removeWord(data, 0));
      return;
    }

    if (firstWord === "whisper") {
      // get the players name
      const name = parseWord(data, 1);
      const message = removeWord(removeWord(data, 0), 0);
      this.whisper(message, name);
      return;
    }

    if (firstWord === "experience" || firstWord === "exp" || firstWord === "xp") {
      p.sendString(this.printExperience());
      return;
    }

    if (firstWord === "help" || firstWord === "commands") {
      p.sendString(Game.printHelp(p.rank));
      return;
    }

    if (firstWord === "inventory" || firstWord === "inv") {
      p.sendString(this.printInventory());
      return;
    }

    if (firstWord === "quit") {
      this.connection.close();
      Game.logoutMessage(p.name + " has left the realm.", p);
      return;
    }

    if (firstWord === "remove") {
      this.removeItem(parseWord(data, 1));
      return;
    }

    if (firstWord === "stats" || firstWord === "st") {
      p.sendString(this.printStats());
      return;
    }

    if (firstWord === "time") {
      const msg = "<bold><cyan>" +
        "The current system time is: " +
        Util.timeStamp() + " on " +
        Util.dateStamp() + "\r\n" +
        "The system has been up for: " +
        Util.upTime() + "</cyan></bold>";
      p.sendString(msg);
      return;
    }

    if (firstWord === "use") {
      this.useItem(removeWord(data, 0));
      return;
    }

    if (firstWord === "who") {
      p.sendString(Game.whoList(
        parseWord(data, 1).toLowerCase()));
      return;
    }

    if (firstWord === "look" || firstWord === "l") {
      p.sendString(Game.printRoom(p.room));
      return;
    }

    if (firstWord === "north" || firstWord === "n") {
      this.move(Direction.NORTH);
      return;
    }

    if (firstWord === "east" || firstWord === "e") {
      this.move(Direction.EAST);
      return;
    }

    if (firstWord === "south" || firstWord === "s") {
      this.move(Direction.SOUTH);
      return;
    }

    if (firstWord === "west" || firstWord === "w") {
      this.move(Direction.WEST);
      return;
    }

    if (firstWord === "drop") {
      this.dropItem(removeWord(data, 0));
      return;
    }

    if (firstWord === "train") {
      if (p.room.type !== RoomType.TRAININGROOM) {
        p.sendString("<red><bold>You cannot train here!</bold></red>");
        return;
      }
      if (p.train()) {
        p.sendString("<green><bold>You are now level " +
                     p.level + "</bold></green>");
      } else {
        p.sendString("<red><bold>You don't have enough " +
                     "experience to train!</bold></red>");
      }
      return;
    }

    if (firstWord === "editstats") {
      if (p.room.type !== RoomType.TRAININGROOM) {
        p.sendString("<red><bold>You cannot edit your stats here!</bold></red>");
        return;
      }
      this.goToTrain();
      return;
    }

    if (firstWord === "list") {
      if (p.room.type !== RoomType.STORE) {
        p.sendString("<red><bold>You're not in a store!</bold></red>");
        return;
      }
      p.sendString(Game.storeList(p.room.data));
      return;
    }

    if (firstWord === "buy") {
      if (p.room.type !== RoomType.STORE) {
        p.sendString("<red><bold>You're not in a store!</bold></red>");
        return;
      }
      this.buy(removeWord(data, 0));
      return;
    }

    if (firstWord === "sell") {
      if (p.room.type !== RoomType.STORE) {
        p.sendString("<red><bold>You're not in a store!</bold></red>");
        return;
      }
      this.sell(removeWord(data, 0));
      return;
    }

    if (firstWord === "attack" || firstWord === "a") {
      this.playerAttack(removeWord(data, 0));
      return;
    }

    if (firstWord === "quests" || firstWord === "quest") {
      var questsMsg="";
      for (var i = 0; i < p.quests.length; i++) {
        questsMsg=questsMsg+p.quests[i].charAt(0).toUpperCase()+p.quests[i].slice(1)+', ';
      };
      questsMsg=questsMsg.slice(0, -2)+'.';
      if (p.quests.length==0) {questsMsg="You didn't achieve any quests."};

      p.sendString("Achieved Quests: "+questsMsg);
      return;
    }

    if (firstWord === "run") {
      var runStr = removeWord(data, 0);
      var runPat = runStr.match(/[a-z]+|[^a-z]+/gi);
      var runValid=true;
      function inValidRun(str){
        runValid=false;
        p.sendString('<bold><red>'+str+'</red></bold>');
        return;
      }
      if (!Array.isArray(runPat)) {inValidRun();return;}

      for (var r = 0; r < runPat.length; r++) {if (isNaN(runPat[r]) && runPat[r].length>1) {inValidRun('Your run pattern is invalid.');return;}}
      if ( isNaN(runPat[0]) || isNaN(runPat[runPat.length-1])==false || (runPat.length % 2)==1 )  {inValidRun('Your run pattern is invalid.');return;}
      var vds=['n','s','e','w'];
      for (var r = 0; r < runPat.length; r=r+2) {
        runPat[r+1]=runPat[r+1].toLowerCase();
          if (vds.includes(runPat[r+1])==false) {
            inValidRun()
            return
          }
        }
      for (var r = 0; r < runPat.length; r=r+2) {if (runPat[r] > 30) {
        inValidRun('Your run pattern is invalid (don\'t use numbers greater than 30).');
        return;}
      }  
      p.runPat = [];
      for (var r = 0; r < runPat.length; r=r+2) {
        for (var t = 0; t < runPat[r]; t++) {
            p.runPat.push(runPat[r+1])
        }
      }
      var diz=this;
      if (runValid) {
        p.runInterval = setInterval(function(){ 
          if (!diz.player.runPat||diz.player.runPat.length==0||!diz.player.loggedIn) {
            clearInterval(diz.player.runInterval);
            return;
          };
          var ri = diz.player.runPat[0];
          if (ri=="n") { diz.move(Direction.NORTH) }
          if (ri=="s") { diz.move(Direction.SOUTH) }
          if (ri=="w") { diz.move(Direction.WEST) }
          if (ri=="e") { diz.move(Direction.EAST) }
          diz.player.runPat.shift()
        }, 200);
      }
      return;
    }

    //~ziad87 map
    if (firstWord == 'map'){
      var msg = '';
      var oRoom = p.room  
      var Chunks = [];
      var lv1 = [];
      function num2dir(n){
        var dir;
        if(n==0)dir = Direction.NORTH;
        if(n==1)dir = Direction.EAST;
        if(n==2)dir = Direction.SOUTH;
        if(n==3)dir = Direction.WEST;
        return dir;
      }
      function wordWrap(str, width, spaceReplacer) {
        if (str.length>width) {
            var p=width
            for (;p>0 && str[p]!='';p--) {
            }
            if (p>0) {
              var left = str.substring(0, p);
              var right = str.substring(p+1);
              return left + spaceReplacer + wordWrap(right, width, spaceReplacer);
            }
        }
        return str;
      }
      var padEnd = (string, chars, filler)=>{
        if (isNaN(chars))return null;
        var str = string.substr(0, chars);
        filler = filler.substr(0, 1);
        if (str.length >= chars)return str;
        var a = str.split('');
        var left = chars-a.length;
        for (var i=0; i<left; i++){
          a.push(filler);
        };
        return a.join('');
      }
      for (var i=0;i<4; i++){
        var dir = num2dir(i);
        if (oRoom.rooms[dir]){
          lv1.push({dir: dir, room: roomDb.findById(oRoom.rooms[dir])});
        }else{lv1.push({dir: dir, room: false})}

      }  
      function makeChunk(room, x, y, current){
        var chunk = {x: x, y: y};
        var lines = [];
        function doIt(){
          var name = wordWrap(room.name, 9, '\n').split('\n');
          var color1, color2;
          if(!name[0]){name = ['', '', '']};
          if(!name[1]){name.push('');name.push('')};
          if(!name[2]){name.push('')};
          /*
          if (room.id == 1){
            color1 = '<green>';
            color2 = '</green>'
          }
          if (room.type == RoomType.STORE){
            color1 = '<cyan>';
            color2 = '</cyan>';
          }
          if (room.type == RoomType.TRAININGROOM){
            color1 = '<magenta>';
            color2 = '</magenta>';
          }
          */
          /*
          // bug
          if (room.key){
            if (room.key != -1 && room.key != {}){
              console.log(room.key)
              color1 = '<yellow>';
              color2 = '</yellow>'
              if (!current){
                name = ["Locked", "", ""];
              }
            }
          }  
          */ 
          var roomSpace = " ";
          if (current){
            color1 = '<bold><cyan>';
            color2 = '</cyan></bold>';
            roomSpace = '<bold><cyan>@</cyan></bold>'
          }
          lines.push(`<black>.</black>${room.rooms[Direction.NORTH] ? '<black>.</black>#<black>.</black>' : '<black>...</black>'}<black>.</black>`)
          //lines.push(` ${color1 ? color1 : ''}###########${color2 ? color2 : ''} `);
          lines.push('<black>.</black>+-+<black>.</black>');
          //lines.push(` ${color1 ? color1 : ''}#${padEnd(name[0], 9, ' ')}#${color2 ? color2 : ''} `);
          //lines.push(`${room.rooms[Direction.WEST] ? '-' : ' '}${color1 ? color1 : ''}#${padEnd(name[1], 9, ' ')}#${color2 ? color2 : ''}${room.rooms[Direction.EAST] ? '-' : ' '}`);
          var dW = '<black>.</black>';
          var dE = '<black>.</black>';
          if (room.rooms[Direction.WEST]!=0) {dW='#'};
          if (room.rooms[Direction.EAST]!=0) {dE='#'};
          lines.push(dW+'|'+roomSpace+'|'+dE);
          //lines.push(`${room.rooms[Direction.WEST] ? '-' : ' '}+'| |'+${room.rooms[Direction.EAST] ? '-' : ' '}`);
          //lines.push(` ${color1 ? color1 : ''}#${padEnd(name[2], 9, ' ')}#${color2 ? color2 : ''} `)
          //lines.push(` ${color1 ? color1 : ''}###########${color2 ? color2 : ''} `);
          lines.push('<black>.</black>+-+<black>.</black>');
          lines.push(`<black>.</black>${room.rooms[Direction.SOUTH] ? '<black>.</black>#<black>.</black>' : '<black>...</black>'}<black>.</black>`)
          //lines.push(`[ ]`);
        }
        function dont(){
          for (var i=0;i<7;i++){
            lines.push('<black>.....</black>')
          }
        }
        if(room){doIt()}else{dont()}
        chunk.lines = lines;
        return chunk;
      }
      var lv2 = {};
      Chunks.push(makeChunk(oRoom, 3, 3, true));
      lv1.forEach((room)=>{
        if (room.room){
          if(room.dir.key == 'NORTH'){
            Chunks.push(makeChunk(room.room, 3, 2, false));
            lv2[room.room.id] = [];
            for (var i=0;i<4; i++){
              var dir = num2dir(i);
              if (room.room.rooms[dir]){
                if (!room.room.key || room.room.key == {} || room.room.key == -1){
                  lv2[room.room.id].push({oDir: room.dir.key, dir: dir, room: roomDb.findById(room.room.rooms[dir])});
                }
              }else{lv2[room.room.id].push({dir: dir, room: false})}
            }
          }
          if(room.dir.key == 'SOUTH'){
            Chunks.push(makeChunk(room.room, 3, 4, false));
            lv2[room.room.id] = [];
            for (var i=0;i<4; i++){
              var dir = num2dir(i);
              if (room.room.rooms[dir]){
                if (!room.room.key || room.room.key == {} || room.room.key == -1){
                  lv2[room.room.id].push({oDir: room.dir.key, dir: dir, room: roomDb.findById(room.room.rooms[dir])});
                }
              }else{lv2[room.room.id].push({dir: dir, room: false})}
            }
          }
          if(room.dir.key == 'WEST'){
            Chunks.push(makeChunk(room.room, 2, 3, false));
            lv2[room.room.id] = [];
            for (var i=0;i<4; i++){
              var dir = num2dir(i);
              if (room.room.rooms[dir]){
                if (!room.room.key || room.room.key == {} || room.room.key == -1){
                  lv2[room.room.id].push({oDir: room.dir.key, dir: dir, room: roomDb.findById(room.room.rooms[dir])});
                }
              }else{lv2[room.room.id].push({dir: dir, room: false})}
            }
          }
          if(room.dir.key == 'EAST'){
            Chunks.push(makeChunk(room.room, 4, 3, false));
            lv2[room.room.id] = [];
            for (var i=0;i<4; i++){
              var dir = num2dir(i);
              if (room.room.rooms[dir]){
                if (!room.room.key || room.room.key == {} || room.room.key == -1){
                  lv2[room.room.id].push({oDir: room.dir.key, dir: dir, room: roomDb.findById(room.room.rooms[dir])});
                }
              }else{lv2[room.room.id].push({dir: dir, room: false})}
            }
          }
        }
      })
      for (var key in lv2){
        var arr = lv2[key];
        arr.forEach((room)=>{
          if (room.oDir == 'NORTH'){
            if (room.dir.key == 'NORTH'){
               Chunks.push(makeChunk(room.room, 3, 1, false));
            }
            if (room.dir.key == 'EAST'){
               Chunks.push(makeChunk(room.room, 4, 2, false));
            }
            if (room.dir.key == 'WEST'){
               Chunks.push(makeChunk(room.room, 2, 2, false));
            }
          }
          if (room.oDir == 'SOUTH'){
            if (room.dir.key == 'SOUTH'){
               Chunks.push(makeChunk(room.room, 3, 5, false));
            }
            if (room.dir.key == 'EAST'){
               Chunks.push(makeChunk(room.room, 4, 4, false));
            }
            if (room.dir.key == 'WEST'){
               Chunks.push(makeChunk(room.room, 2, 4, false));
            }
          }
          if (room.oDir == 'EAST'){
            if (room.dir.key == 'EAST'){
               Chunks.push(makeChunk(room.room, 5, 3, false));
            }
            if (room.dir.key == 'SOUTH'){
               Chunks.push(makeChunk(room.room, 4, 4, false));
            }
            if (room.dir.key == 'NORTH'){
               Chunks.push(makeChunk(room.room, 4, 2, false));
            }
          }
          if (room.oDir == 'WEST'){
            if (room.dir.key == 'WEST'){
               Chunks.push(makeChunk(room.room, 1, 3, false));
            }
            if (room.dir.key == 'SOUTH'){
               Chunks.push(makeChunk(room.room, 2, 4, false));
            }
            if (room.dir.key == 'NORTH'){
               Chunks.push(makeChunk(room.room, 2, 2, false));
            }
          }
        });
      }
      var chk = {};
      Chunks.forEach((chunk)=>{
        chk[[chunk.x, chunk.y]] = chunk;
      });
      for (var x=1; x<6; x++){
        for (var y=1; y<6; y++){
          if (!chk[[x, y]]){
            chk[[x, y]] = makeChunk(false, x, y, false);
          }
        }
      }
      var lines = [];
                                                          
      for (var y=1; y<5; y++){
        for (var l=0; l<5; l++){
          var a = `${chk[[1, y]].lines[l]}${chk[[2, y]].lines[l]}${chk[[3, y]].lines[l]}${chk[[4, y]].lines[l]}${chk[[5, y]].lines[l]}`;
          //if (a != `                                                                 `){
            lines.push(a);
          //}
        }
      }
      p.sendString(lines.join('\n'));
      return;
      //wow such code
      //idk why i wrote this
      //but it worke (TM)
    }
    //// 


    /* map2 wip obsolete */
    if (firstWord === "map2") {
      var tempMap=[
        [['<black>...</black>'],['<black>...</black>'],['<black>...</black>'],['<black>...</black>'],['<black>...</black>']],
        [['<black>...</black>'],['<black>...</black>'],['<black>...</black>'],['<black>...</black>'],['<black>...</black>']],
        [['<black>...</black>'],['<black>...</black>'],['|<cyan>@</cyan>|'],['<black>...</black>'],['<black>...</black>']],
        [['<black>...</black>'],['<black>...</black>'],['<black>...</black>'],['<black>...</black>'],['<black>...</black>']],
        [['<black>...</black>'],['<black>...</black>'],['<black>...</black>'],['<black>...</black>'],['<black>...</black>']]
      ]
      var pPos=[2,2];
      //console.log(map)
      //level1
      if (p.room.rooms.NORTH!=0) { 
        tempMap[pPos[0]-1][pPos[1]]='|_|'
      };
      if (p.room.rooms.SOUTH!=0) { tempMap[pPos[0]+1][pPos[1]]='|_|'
      };
      if (p.room.rooms.EAST!=0) { tempMap[pPos[0]][pPos[1]+1]='|_|'
      };
      if (p.room.rooms.WEST!=0) { tempMap[pPos[0]][pPos[1]-1]='|_|'
      };
      var tempMapRenderer = "";
      for (var y = 0; y < tempMap.length; y++) {
        for (var x = 0; x < tempMap[y].length; x++) {
          tempMapRenderer+=tempMap[y][x];
        };
        tempMapRenderer+='\n'
      };
      p.sendString(tempMapRenderer);
      console.log(tempMapRenderer)
      return;
    }

    // ------------------------------------------------------------------------
    //  GOD access commands
    // ------------------------------------------------------------------------

    if (firstWord === "kick" && p.rank >= PlayerRank.GOD) {

      const targetName = parseWord(data, 1);
      if (targetName === '') {
        p.sendString("<red><bold>Usage: kick <name></bold></red>");
        return;
      }

      // find a player to kick
      const target = playerDb.findLoggedIn(targetName);
      if (!target) {
        p.sendString("<red><bold>Player could not be found</bold></red>");
        return;
      }

      if (target.rank > p.rank) {
        p.sendString("<red><bold>You can't kick that player!</bold></red>");
        return;
      }

      target.connection.close();
      p.sendString("<cyan><bold>You kick " + target.name + " out of the realm</bold></cyan>");
      Game.logoutMessage(target.name +
        " has been kicked by " + p.name + "!!!", target);
      return;
    }

    // ------------------------------------------------------------------------
    //  ADMIN access commands
    // ------------------------------------------------------------------------

    if (firstWord === "announce" && p.rank >= PlayerRank.ADMIN) {
      Game.announce(removeWord(data, 0));
      return;
    }

    if (firstWord === "changerank" && p.rank >= PlayerRank.ADMIN) {
      const name = parseWord(data, 1);
      let rank = parseWord(data, 2);

      if (name === '' || rank === '') {
        p.sendString("<red><bold>Usage: changerank <name> <rank></bold></red>");
        return;
      }

      // find the player to change rank
      const target = playerDb.findByNameFull(name);
      if (!target) {
        p.sendString("<red><bold>Error: Could not find user " +
          name + "</bold></red>");
        return;
      }

      rank = PlayerRank.get(rank.toUpperCase());
      if (!rank) {
        p.sendString("<red><bold>Invalid rank!</bold></red>");
        return;
      }

      target.rank = rank;
      Game.sendGame("<green><bold>" + target.name +
        "'s rank has been changed to: " + target.rank.toString());
      return;
    }

    if (firstWord === "reload" && p.rank >= PlayerRank.ADMIN) {
      const db = parseWord(data, 1);

      if (db === '') {
        p.sendString("<red><bold>Usage: reload <db></bold></red>");
        return;
      }

      if (db === "items") {
        itemDb.load();
        p.sendString("<bold><cyan>Item Database Reloaded!</cyan></bold>");
      } else if (db === 'rooms') {
        roomDb.loadTemplates();
        p.sendString("<bold><cyan>Room Database Reloaded!</cyan></bold>");
      } else if (db === 'stores') {
        storeDb.load(itemDb);
        p.sendString("<bold><cyan>Store Database Reloaded!</cyan></bold>");
      } else if (db === 'enemies') {
        enemyTpDb.load();
        p.sendString("<bold><cyan>Enemy Database Reloaded!</cyan></bold>");
      } else {
        p.sendString("<bold><red>Invalid Database Name!</red></bold>");
      }
      return;
    }

    if (firstWord === "shutdown" && p.rank >= PlayerRank.ADMIN) {
      Game.announce("SYSTEM IS SHUTTING DOWN");
      Game.setIsRunning(false);
      return;
    }

    // ------------------------------------------------------------------------
    //  Command not recognized, send to room
    // ------------------------------------------------------------------------
    /*
    var n=p.name;
    for (var i = n.length; i < 16; i++) {
      n="."+n;
    };
    */
    
    Game.sendRoom("<bold><cyan>" + p.name + " says:</cyan> " + cc('dim') +
                  data + "</bold>", p.room);

  }

  leave() {
    const p = this.player;
    // deactivate player
    p.active = false;
    // log out the player from the database if the connection has been closed
    if (this.connection.isClosed) {
      playerDb.logout(p.id);
      if (isNaN(p.room)) p.room.removePlayer(p);
    }
  }

  // ------------------------------------------------------------------------
  //  This notifies the handler that a connection has unexpectedly hung up.
  // ------------------------------------------------------------------------
  hungup() {
    const p = this.player;
    Game.logoutMessage(`${p.name} has suddenly disappeared from the realm.`, p);
    this.connection.close();
  }

  goToTrain() {
    const conn = this.connection;
    const p = this.player;
    Game.logoutMessage(p.name + " leaves to edit stats", p);
    conn.addHandler(new Train(conn, p));
  }

  useItem(name) {
    const p = this.player;
    const index = p.getItemIndex(name);

    if (index === -1) {
      p.sendString("<red><bold>Could not find that item!</bold></red>");
      return false;
    }

    const item = p.inventory[index];

    switch(item.type) {
      case ItemType.WEAPON:
        p.useWeapon(index);
        Game.sendRoom("<green><bold>" + p.name + " arms a " +
                      item.name + "</bold></green>", p.room);
        return true;
      case ItemType.ARMOR:
        p.useArmor(index);
        Game.sendRoom("<green><bold>" + p.name + " puts on a " +
                      item.name + "</bold></green>", p.room);
        return true;
      case ItemType.HEALING:
        const min = item.min;
        const max = item.max;
        p.addBonuses(item);
        p.addHitPoints(random(min, max));
        p.dropItem(index);
        if (p.hitPoints<p.GetAttr(Attribute.MAXHITPOINTS)) {p.printStatbar()}
        return true;
    }

    return false;
  }

  removeItem(typeName) {
    const p = this.player;

    typeName = typeName.toLowerCase();

    if (typeName === "weapon" && p.Weapon() !== 0) {
      p.sendString("<green><bold>"+p.name+" disarms "+p.Weapon().name+"</bold></green>");
      p.removeWeapon();
      return true;
    }

    if (typeName === "armor" && p.Armor() !== 0) {
      p.sendString("<green><bold>"+p.name+" takes off "+p.Armor().name+"</bold></green>");
      p.removeArmor();
      return true;
    }

    p.sendString("<red><bold>Could not Remove item!</bold></red>");
    return false;
  }

  move(dir, force) { // ziad
    const p = this.player;
    if (!dir.hasOwnProperty('key')) {
      p.sendString("<red>Invalid direction!</red>");
      return;
    }
    const next = roomDb.findById(p.room.rooms[dir]);
    const previous = p.room;

    if (!next) {
      // bump
      Game.sendRoom("<red>" + p.name + " bumps into the wall to the " +
                    dir.key + "!!!</red>", p.room);
      p.addHitPoints(-1);
      p.printStatbar();
      if (p.hitPoints <= 0) {
        Game.playerKilled(p);
      }
      return;
    }
    if (!force){
      if (next.key){
        if (next.key != {} && next.key != -1){
          var key = next.key;
          if (key.TYPE){
            var type = key.TYPE.toLowerCase();
            var keyText="";
            if (key.TEXT!=undefined&&key.TEXT.trim()!="") {
              keyText=key.TEXT.trim();
            };
            if (key.TYPE == "ITEM"){
              if (key.ID){
                if (itemDb.findById(key.ID)){
                  let found = false;
                  let name = itemDb.findById(key.ID).name;
                  p.inventory.forEach((itm)=>{
                    if (itm.name == name)found = true;
                  });
                  if (!found){
                    if (keyText!="") {p.sendString(keyText)};
                    return p.sendString(`<yellow>Can't enter without a <bold><yellow>${name}</yellow></bold></yellow>`);
                  }
                  p.sendString(`<green>You used your <bold><green>${name}</green></bold> to pass.</green>`);
                }
              }
            }else if (key.TYPE == "MONEY"){
              if (key.AMOUNT){
                if (key.AMOUNT > p.money){
                  if (keyText!="") {p.sendString(keyText)};
                  return p.sendString(`<yellow>Can't enter without <bold><yellow>$${key.AMOUNT}</yellow></bold></yellow>`);
                }
                this.qState = key.AMOUNT; 
                this.lDir = dir;
                if (keyText!="") {p.sendString(keyText)};
                return p.sendString(`<yellow>To enter this place, you need to pay <bold><yellow>$${key.AMOUNT}</yellow></bold>. [Yes/No]</yellow>`);
              }
            }else if (key.TYPE == "LEVEL"){
              if (key.LEVEL){
                if (p.level < key.LEVEL){
                  if (keyText!="") {p.sendString(keyText)};
                  return p.sendString(`<yellow>You need to be <bold><yellow>level ${key.LEVEL}</yellow></bold> to pass.</yellow>`)
                }
                p.sendString(`<green>You are experienced enough to pass.</green>`)
              }
            }else if (key.TYPE == "PASSWORD"){
              if (key.PASSWORD){
                if (keyText!="") {p.sendString(keyText)};
                this.qWord = key.PASSWORD;
                this.lDir = dir;
                return p.sendString(`<yellow>You need a <bold><yellow>password</yellow></bold>.</yellow>`);
              }
            }

          }
        }
      }
    }

    previous.removePlayer(p);

    Game.sendRoom("<green>"  + p.name + " leaves to the " +
                  dir.key + ".</green>", previous);
    Game.sendRoom("<green>"  + p.name + " enters from the " +
                  this._oppositeDirection(dir) + ".</green>", next);
    p.sendString("<green>You walk " + dir.key + ".</green>");

    p.room = next;
    next.addPlayer(p);

    p.sendString(Game.printRoom(next));
  }

  _oppositeDirection(dir) {
    switch (dir) {
      case Direction.NORTH:
        return Direction.SOUTH.key;
      case Direction.EAST:
        return Direction.WEST.key;
      case Direction.SOUTH:
        return Direction.NORTH.key;
      case Direction.WEST:
        return Direction.EAST.key;
      default:
        return false;
    }
  }

  getItem(item) {
    const p = this.player;
    if (item[0] === '$') {
      // clear off the '$', and convert the result into a number.
      const money = Math.abs( parseInt(item.substr(1, item.length - 1)) );
      if (!isNaN(money)) { // if valid money amount
        // make sure there's enough money in the room
        if (money > p.room.money) {
          p.sendString("<red><bold>There isn't that much here!</bold></red>");
        } else {
          p.money += money;
          p.room.money -= money;
          Game.sendRoom("<cyan><bold>" + p.name + " picks up $" +
                        money + ".</bold></cyan>", p.room);
        }
        return;
      }
    }

    const i = p.room.findItem(item);

    if (!i) {
      p.sendString("<red><bold>You don't see that here!</bold></red>");
      return;
    }

    if (!p.pickUpItem(i)) {
      p.sendString("<red><bold>You can't carry that much!</bold></red>");
      return;
    }

    p.room.removeItem(i);
    Game.sendRoom("<cyan><bold>" + p.name + " picks up " +
                  i.name + ".</bold></cyan>", p.room);
  }

  dropItem(item) {
    const p = this.player;

    if (item[0] === '$') {
      // clear off the '$', and convert the result into a number.
      const money = Math.abs( parseInt(item.substr(1, item.length - 1))  );
      if (!isNaN(money)) { // if valid money amount
        // make sure there's enough money in the room
        if (money > p.money) {
          p.sendString("<red><bold>You don't have that much!</bold></red>");
        } else {
          p.money -= money;
          p.room.money += money;
          Game.sendRoom("<cyan><bold>" + p.name + " drops $" +
                        money + ".</bold></cyan>", p.room);
        }
        return;
      }
    }

    const i = p.getItemIndex(item);

    if (i === -1) {
      p.sendString("<red><bold>You don't have that!</bold></red>");
      return;
    }

    Game.sendRoom("<cyan><bold>" + p.name + " drops " +
                  p.inventory[i].name + ".</bold></cyan>", p.room);
    p.room.addItem(p.inventory[i]);
    p.dropItem(i);
  }

  drop4exp(item) {
    const p = this.player;
    if (item[0] === '$') {
      const money = Math.abs( parseInt(item.substr(1, item.length - 1))  );
      if (!isNaN(money)) {
        if (money > p.money) {
          p.sendString("<red><bold>You don't have that much!</bold></red>");
        } else {
          p.money -= money;
          p.experience += money*happyHour;
          Game.sendRoom("<cyan><bold>" + p.name + " drops $" +
                        money + " into oblivion.</bold></cyan>", p.room);
          console.log('drop: '+money);
        }
        return;
      }
    }
    const i = p.getItemIndex(item);
    if (i === -1) {
      p.sendString("<red><bold>You don't have that!</bold></red>");
      return;
    }
    Game.sendRoom("<cyan><bold>" + p.name + " drops " +
                  p.inventory[i].name + " into oblivion.</bold></cyan>", p.room);
    console.log('drop: '+p.inventory[i].price);
    p.experience += p.inventory[i].price*happyHour;
    p.dropItem(i);
  }

  buy(itemName) {
    const p = this.player;
    const s = storeDb.findById(p.room.data);
    if (!s) return false;
    const i = s.findItem(itemName);

    if (i === 0) {
      p.sendString("<red><bold>Sorry, we don't have that item!</bold></red>");
      return;
    }
    if (p.money < i.price) {
      p.sendString("<red><bold>Sorry, but you can't afford that!</bold></red>");
      return;
    }
    if (!p.pickUpItem(i)) {
      p.sendString("<red><bold>Sorry, but you can't carry that much!</bold></red>");
      return;
    }

    p.money -= i.price;
    Game.sendRoom("<cyan><bold>" + p.name + " buys a " +
                  i.name +"</bold></cyan>", p.room);
  }

  sell(itemName) {
    const p = this.player;
    const s = storeDb.findById(p.room.data);
    if (!s) return false;
    const index = p.getItemIndex(itemName);

    if (index === -1) {
      p.sendString("<red><bold>Sorry, you don't have that!</bold></red>");
      return;
    }
    const i = p.inventory[index];
    if (!s.findItem(i.name)) {
      p.sendString("<red><bold>Sorry, we don't want that item!</bold></red>");
      return;
    }
    /*
    if (itemName==p.weapon) {
      removeWeapon();
    };
    if (itemName==p.armor) {
      removeArmor();
    };
    */
    p.dropItem(index);
    p.money += i.price;
    Game.sendRoom("<cyan><bold>" + p.name + " sells a " +
                  i.name + "</bold></cyan>", p.room);
  }

  static probaHit(gap) {
    const x = (gap - 50) / 25;
    return (x / (1 + Math.abs(x)) + 1) / 2;
  }

  static randomHit(accuracy, dodging) {
    return Game.probaHit (accuracy - dodging) > Math.random();
  }

  playerAttack(enemyName) {

    const p = this.player;
    const now = timer.getMS();
    var ap;

    if (now < p.nextAttackTime) {

      var msg = "<red><bold>You can't attack yet!</bold></red>"
      if (p.lastMessage!=msg) {
        p.sendString(msg);
      };   
      return;
    }

    const seconds = Util.seconds;
    const weapon = p.Weapon();  

    // PVP 1/2
    if (enemyName.trim()!=""&&PVP) {
      for (var i = 0; i < this.player.room.players.length; i++) {
        if (this.player.room.players[i].id!=this.player.id) {
          if (enemyName.toLowerCase().trim()==this.player.room.players[i].name.toLowerCase().trim()) {
            ap = this.player.room.players[i];
          };
          
        };
      };
    };
    // random player?
    // p.room.players[random(0, p.room.players.length - 1)];
    // PVP end
    let damage;
    if (weapon === 0) {
      damage = random(1, 3);
      p.nextAttackTime = now + seconds(1);
    } else {
      if (weapon!=undefined) {
        damage = random(weapon.min, weapon.max);        
      }else{
        damage = 1;
      }
      p.nextAttackTime = now + seconds(weapon.speed);
    }
    const attr = p.GetAttr.bind(p);
    const A = Attribute;
    // PVP 2/2
    if (ap!=undefined) {
      var noAttack=false;
      var temp=[1]
       for (var i = 0; i < temp.length; i++) {
         if (p.room.id==temp[i]) {
            noAttack=true;
         };
       };
       if (p.room.type.key!='PLAINROOM') {noAttack=true};
        if (noAttack) {

            var msg = "<red><bold>You can't attack players here!</bold></red>"
            if (p.lastMessage!=msg) {
              p.sendString(msg);
            };
            return;
         };
        if (! Game.randomHit (attr(A.ACCURACY), ap.attributes.DODGING)) {
          Game.sendRoom("<white>" + p.name + " swings at " + ap.name +
                        " but misses!</white>", p.room);
          return;
        }
        damage += attr(A.STRIKEDAMAGE);
        damage -= ap.attributes.DAMAGEABSORB;
        if (damage < 1) damage = 1;
        ap.addHitPoints(-damage);
        Game.sendRoom("<green><bold>" + p.name + " hits " + ap.name + " for " +
                  damage + " damage!</bold></green>", p.room);
        ap.printStatbar();
        if (ap.hitPoints <= 0) {
          Game.playerKilled(ap);
          // add experience to the player who killed
          const aexp = Math.floor(ap.experience / 10);
          p.experience += aexp*happyHour;
          p.sendString("<cyan><bold>You gain " + aexp*happyHour +
                 " experience.</bold></cyan>");

        }
        return;
    };
    // end PVP

    const enemy = p.room.findEnemy(enemyName);

    if (enemy === 0) {
      var msg = "<red><bold>You don't see that here!</bold></red>"
      if (p.lastMessage!=msg) {
        p.sendString(msg);
      };
      return;
    }

    const e = enemy.tp;

    if (! Game.randomHit (attr(A.ACCURACY), e.dodging)) {
      Game.sendRoom("<white>" + p.name + " swings at " + e.name +
                    " but misses!</white>", p.room);
      return;
    }

    damage += attr(A.STRIKEDAMAGE);
    damage -= e.damageAbsorb;

    if (damage < 1) damage = 1;

    enemy.hitPoints -= damage;

    Game.sendRoom("<green><bold>" + p.name + " hits " + e.name + " for " +
                  damage + " damage!</bold></green>", p.room);

    if (enemy.hitPoints <= 0) {
      Game.enemyKilled(enemy, p);
    }
  }

  static enemyAttack(enemy) {
    const e = enemy.tp;
    const room = enemy.room;
    const now = timer.getMS();
    const seconds = Util.seconds;

    const p = room.players[random(0, room.players.length - 1)];

    let damage;
    if (e.weapon === 0) {
      damage = random(1, 3);
      enemy.nextAttackTime = now + seconds(1);
    } else {
      const weapon = (isNaN(e.weapon) ? e.weapon : itemDb.findById(e.weapon));
      damage = random(weapon.min, weapon.max);
      enemy.nextAttackTime = now + seconds(weapon.speed);
    }

    const attr = p.GetAttr.bind(p);
    const A = Attribute;

    if (! Game.randomHit (e.accuracy, attr(A.DODGING))) {
      Game.sendRoom("<white>" + e.name + " swings at " + p.name +
                    " but misses!</white>", enemy.room);
      return;
    }

    damage += e.strikeDamage;
    damage -= attr(A.DAMAGEABSORB);

    if (damage < 1) damage = 1;

    p.addHitPoints(-damage);

    Game.sendRoom("<red>" + e.name + " hits " + p.name + " for " +
                  damage + " damage!</red>", enemy.room);

    p.printStatbar();

    if (p.hitPoints <= 0) {
      Game.playerKilled(p);
    }
  }

  static playerKilled(player) {
    const p = player;
    if (p.runPat) { p.runPat=[] }
    Game.sendRoom("<red><bold>" + p.name +
                  " has died!</bold></red>", p.room);
    // drop the money
    const money = Math.floor(p.money / 10);
    if (money > 0) {
      p.room.money += money;
      p.money -= money;
      Game.sendRoom("<cyan>$" + money +
                    " drops to the ground.</cyan>", p.room);
    }

    // drop an item
    if (p.items > 0) {
      const index = random(0, p.items - 1);
      const item = p.inventory[index];
      p.room.addItem(item);
      p.dropItem(index);
      Game.sendRoom("<cyan>" + item.name + " drops to the ground." +
                    "</cyan>", p.room);
    }

    // subtract 10% experience
    const exp = Math.floor(p.experience / 10);
    p.experience -= exp;

    // remove the player from the room and transport him to room 1.
    p.room.removePlayer(p);
    p.room = roomDb.findById(1);
    p.room.addPlayer(p);

    // set the hitpoints to 70%
    p.setHitPoints(Math.floor(p.GetAttr(Attribute.MAXHITPOINTS) * 0.7));

    p.sendString("<white><bold>You have died, " +
                 "but have been ressurected in " +
                 p.room.name + "</bold></white>");

    p.sendString("<red><bold>You have lost " +
                 exp + " experience!</bold></red>");

    Game.sendRoom("<white><bold>" + p.name +
                  " appears out of nowhere!!</bold></white>", p.room);
  }

  static playerTele(player,dest) {
    const p = player;
    p.room.removePlayer(p);
    Game.sendRoom("<green>" + p.name + " vanishes into thin air.</green>", p.room);
    p.room = roomDb.findById(dest);
    Game.sendRoom("<green>" + p.name + " appears out of nowhere.</green>", p.room);
    p.room.addPlayer(p);
    p.sendString(Game.printRoom(p.room));
  }

  static enemyKilled(enemy, player) {
    const e = enemy.tp;
    const p = player;

    Game.sendRoom("<cyan><bold>" + e.name +
                  " has died!</bold></cyan>", enemy.room);

    // drop the money
    const money = random(e.moneyMin, e.moneyMax);
    if (money > 0) {
      enemy.room.money += money;
      Game.sendRoom("<cyan>$" + money + " drops to the ground." +
                    "</cyan>", enemy.room);
    }

    // drop all the items
    e.loot.forEach(loot => {
      if (random(0,99) < loot.chance) {
        const item = itemDb.findById(loot.itemId);
        enemy.room.addItem(item);
        Game.sendRoom("<cyan>" + item.name + " drops to the ground." +
                      "</cyan>", enemy.room);
      }
    });

    // add experience to the player who killed it
    p.experience += e.experience*happyHour;
    p.sendString("<cyan><bold>You gain " + e.experience*happyHour +
                 " experience.</bold></cyan>");

    // remove the enemy from the game
    enemyDb.delete(enemy);
  }

  static sendGlobal(msg) {
    Game._sendToPlayers(msg, 'loggedIn');
  }

  static sendGame(msg) {
    Game._sendToPlayers(msg, 'active');
  }

  static sendRoom(text, room) {
    room.players.forEach(player => {
      player.sendString(text);
    });
  }

  static _sendToPlayers(msg, filter) {
    for (let key of playerDb.map.keys()) {
      const player = playerDb.map.get(key);
      if (player[filter]) player.sendString(msg);
    }
  }

  static logoutMessage(reason, player) {
    var msg = "<red><bold>" + reason + "</bold></red>";
    if(player.level >= minlevel)
      Game.sendGame(msg);
    else
      Game.sendRoom(msg, player.room);
  }

  static announce(announcement) {
    Game.sendGlobal("<cyan><bold>" + announcement + "</bold></cyan>");
  }

  whisper(msg, playerName) {
    const player = playerDb.findActive(playerName);
    if (!player) {
      this.player.sendString(
        "<red><bold>Error, cannot find user</bold></red>");
    } else {
      player.sendString(
        "<yellow>" + this.player.name +
        " whispers to you: </yellow>" + msg);
      this.player.sendString(
        "<yellow>You whisper to " + player.name +
        ": </yellow>" + msg);
    }
  }

  static whoList(mode) {
    let str = "<white><bold>" +
      "--------------------------------------------------------------------------------\r\n" +
      " Name             | Level     | Activity | Rank\r\n" +
      "--------------------------------------------------------------------------------\r\n";

    if (mode === 'all') {
      str += Game._who(() => true);
    } else {
      str += Game._who((player) => player.loggedIn);
    }

    str +=
      "--------------------------------------------------------------------------------" +
      "</bold></white>";

    return str;
  }

  static _who(filterFn) {
    let str = "";
    for (let key of playerDb.map.keys()) {
      const player = playerDb.map.get(key);
      if (filterFn(player)) {
        const p = player;
        str += " " + tostring(p.name, 17) + "| ";
        str += tostring(p.level.toString(), 10) + "| ";

        if (p.active) str += "<green>Online  </green>";
        else if (p.loggedIn) str += "<yellow>Inactive</yellow>";
        else str += "<red>Offline </red>";

        str += " | ";
        let rankColor = "";
        switch(p.rank) {
          case PlayerRank.REGULAR: rankColor = "white";   break;
          case PlayerRank.GOD:     rankColor = "yellow";  break;
          case PlayerRank.ADMIN:   rankColor = "green";   break;
        }
        str += "<" + rankColor + ">" + p.rank.toString() +
          "</" + rankColor + ">\r\n";
      }
    }
    return str;
  }

  static printHelp(rank) {
    const help = "<white><bold>" +
        "--------------------------------- Command List ---------------------------------\r\n" +
        " /                          - Repeats your last command exactly.\r\n" +
        /*" chat <mesg>                - Sends message to everyone in the game\r\n" +*/
        " experience                 - Shows your experience statistics\r\n" +
        " help                       - Shows this menu\r\n" +
        " inventory                  - Shows a list of your items\r\n" +
        " quit                       - Allows you to leave the realm.\r\n" +
        " remove <'weapon'/'armor'>  - removes your weapon or armor\r\n" +
        " stats                      - Shows all of your statistics\r\n" +
        " quests                     - Shows your achieved quests\r\n" +
        " time                       - shows the current system time.\r\n" +
        " use <item>                 - use an item in your inventory\r\n" +
        " whisper <who> <msg>        - Sends message to one person\r\n" +
        " who                        - Shows a list of everyone online\r\n" +
        " who all                    - Shows a list of everyone\r\n" +
        " look                       - Shows you the contents of a room\r\n" +
        " north/east/south/west      - Moves in a direction\r\n" +
        " run <pattern>              - Run to some location. eg: run 3w1s\r\n" +
        " get/drop <item>            - Picks up or drops an item on the ground\r\n" +
        " train                      - Train to the next level (TR)\r\n" +
        " editstats                  - Edit your statistics (TR)\r\n" +
        " list                       - Lists items in a store (ST)\r\n" +
        " buy/sell <item>            - Buy or Sell an item in a store (ST)\r\n" +
        " attack <enemy>             - Attack an enemy or a player\r\n</bold></white>";

      const god = "<yellow><bold>" +
        "--------------------------------- God Commands ---------------------------------\r\n" +
        " kick <who>                 - kicks a user from the realm\r\n" +
        "</bold></yellow>";

      const admin = "<green><bold>" +
        "-------------------------------- Admin Commands --------------------------------\r\n" +
        " announce <msg>             - Makes a global system announcement\r\n" +
        " changerank <who> <rank>    - Changes the rank of a player\r\n" +
        " reload <db>                - Reloads the requested database\r\n" +
        " shutdown                   - Shuts the server down\r\n" +
        "</bold></green>";

      const end =
        "--------------------------------------------------------------------------------\r\n";

      switch(rank) {
        case PlayerRank.REGULAR:
          return help + end;
        case PlayerRank.GOD:
          return help + god + end;
        default:
          return help + god + admin + end;
      }
  }

  static storeList(storeId) {
    const s = storeDb.findById(storeId);
    if (!s) return false;
    let output = "<white><bold>" +
                "--------------------------------------------------------------------------------\r\n";
      output += " Welcome to " + s.name + "!\r\n";
      output += "--------------------------------------------------------------------------------\r\n";
      output += " Item                           | Price\r\n";
      output += "--------------------------------------------------------------------------------\r\n";

    s.items.forEach(item => {
      output += " " + tostring(item.name, 31) + "| ";
      output += tostring(item.price) + "\r\n";
    });
    output += "--------------------------------------------------------------------------------\r\n" +
              "</bold></white>";
    return output;
  }

  printExperience() {
    const p = this.player;
    return "<white><bold>" +
      "Level:         " + p.level + "\r\n" +
      " Experience:    " + p.experience + "/" +
      p.needForLevel(p.level + 1) + " (" +
      Math.round(100 * p.experience / p.needForLevel(p.level + 1)) +
      "%)</bold></white>\r\n";
  }

  printStats() {
    const p = this.player;
    const attr = p.GetAttr.bind(p);
    const str = "<white><bold>" +
    "---------------------------------- Your Stats ----------------------------------\r\n" +
    " Name:          " + p.name + "\r\n" +
    " Rank:          " + p.rank.toString() + "\r\n" +
    " HP/Max:        " + p.hitPoints + "/" + attr(Attribute.MAXHITPOINTS) +
    "  (" + Math.round(100 * p.hitPoints / attr(Attribute.MAXHITPOINTS)) + "%)\r\n" +
    this.printExperience() + "\r\n" +
    " Strength:      " + tostring(attr(Attribute.STRENGTH), 16) +
    " Accuracy:      " + tostring(attr(Attribute.ACCURACY)) + "\r\n" +
    " Health:        " + tostring(attr(Attribute.HEALTH), 16) +
    " Dodging:       " + tostring(attr(Attribute.DODGING)) + "\r\n" +
    " Agility:       " + tostring(attr(Attribute.AGILITY), 16) +
    " Strike Damage: " + tostring(attr(Attribute.STRIKEDAMAGE)) + "\r\n" +
    " StatPoints:    " + tostring(p.statPoints, 16) +
    " Damage Absorb: " + tostring(attr(Attribute.DAMAGEABSORB)) + "\r\n" +
    "--------------------------------------------------------------------------------" +
    "</bold></white>\r\n";
    return str;
  }

  printInventory() {
    const p = this.player;

    let itemList = "<white><bold>" +
        "-------------------------------- Your Inventory --------------------------------\r\n" +
        " Items:  ";

    // Inventory
    p.inventory.forEach((item) => {
      itemList += item.name + ", ";
    });

    // chop off the extraneous comma, and add a newline.
    itemList = itemList.slice(0, -2);
    itemList += "\r\n";


    try {


     // console.log(p.inventory);


      // Weapon/Armor
      itemList += " Weapon: ";
      if (p.Weapon() === 0 || p.Weapon().name == undefined) itemList += "NONE!";
      else itemList += p.Weapon().name;

      itemList += "\r\n Armor:  ";
      if (p.Armor() === 0 || p.Armor().name == undefined ) itemList += "NONE!";
      else itemList += p.Armor().name;

      // Money
      itemList += "\r\n Money:  $" + p.money;

      itemList +=
          "\r\n--------------------------------------------------------------------------------" +
          "</bold></white>\r\n";

      return itemList;

    }
    catch(error) {
      console.error(error);

    }


  }

  static printRoom(room) {
    let desc = `\r\n<bold><white>${room.name}</white></bold>\r\n` +
      `<bold><magenta>${room.description}</magenta></bold>\r\n` +
      "<bold><green>exits: ";

    Direction.enums.forEach(dir => {
      if (room.rooms[dir] !== 0) {
        desc += dir.key + "  ";
      }
    });
    desc += "</green></bold>\r\n";

    // ---------------------------------
    // ITEMS
    // ---------------------------------
    let temp = "<bold><yellow>You see: ";
    let count = 0;
    if (room.money > 0) {
      temp += "$" + room.money + ", ";
      count++;
    }

    room.items.forEach(item => {
      temp += item.name + ", ";
      count++;
    });

    if (count > 0) {
      temp = temp.substr(0, temp.length - 2);
      desc += temp + "</yellow></bold>\r\n";
    }

    // ---------------------------------
    // PEOPLE
    // ---------------------------------
    temp = "<bold><cyan>People: ";
    count = 0;

    room.players.forEach(player => {
      temp += player.name + ", ";
      count++;
    });

    if (count > 0) {
      temp = temp.substr(0, temp.length - 2);
      desc += temp + "</cyan></bold>\r\n";
    }

    // ---------------------------------
    // ENEMIES
    // ---------------------------------
    temp = "<bold><red>Enemies: ";
    count = 0;

    room.enemies.forEach(enemy => {
      temp += enemy.name + ", ";
      count++;
    });

    if (count > 0) {
      temp = temp.substr(0, temp.length - 2);
      desc += temp + "</red></bold>\r\n";
    }

    return desc;

  }

}

module.exports = Game;
