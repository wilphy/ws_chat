const http = require('http');
const fs = require('fs');
const mysql = require('mysql');
const io = require('socket.io');
const url = require('url');

//数据库
let db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'ws_chat'
});

db.query(`SELECT * FROM user_table`, (err, data) => {
  if (err) {
    console.log(err);
  } else {
    console.log('数据库连接成功');
  }
});

//hhtp服务器
let httpServer = http.createServer((req, res) => {
  fs.readFile(`views${req.url}`, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.write('Not Found');
    } else {
      res.write(data);
    }

    res.end();
  });
});

httpServer.listen(8080);



//Websocket服务器
let wsSever = io.listen(httpServer);

wsSever.on('connection', sock => {

  let cur_username = '';
  let cur_userID = 0;

  var RegExp = /^\w{3,16}$/;

  //注册
  sock.on('reg', (user, pass) => {
    //1.校验数据
    if (!RegExp.test(user)) {
      sock.emit('reg_ret', 1, '用户名不符合规范');
    } else if (!RegExp.test(pass)) {
      sock.emit('reg_ret', 1, '密码不符合规范');
    } else {
      //2.用户名是否已存在
      db.query(`SELECT ID FROM user_table WHERE username='${user}'`, (err, data) => {
        if (err) {
          sock.emit('reg_ret', 1, '数据库有误');
        } else if (data.length > 0) {
          sock.emit('reg_ret', 1, '用户名已存在')
        } else {
          //3.插入
          db.query(`INSERT INTO user_table (username,password,online) VALUES('${user}','${pass}',0)`, (err, data) => {
            if (err) {
              sock.emit('reg_ret', 1, '数据库有误');
            } else {
              sock.emit('reg_ret', 0, '注册成功');
            }
          })
        }
      });
    }
  });

  //登录
  sock.on('login', (user, pass) => {
    //1.检验数据
    if (!RegExp.test(user)) {
      sock.emit('login_ret', 1, '用户名不符合规范');
    } else if (!RegExp.test(pass)) {
      sock.emit('login_ret', 1, '密码不符合规范');
    } else {
      //2.判断用户是否存在
      db.query(`SELECT ID,password FROM user_table WHERE username='${user}'`, (err, data) => {
        if (err) {
          sock.emit('login_ret', 1, '数据库有误');
        } else if (data.length == 0) {
          sock.emit('login_ret', 1, '此用户不存在');
        } else if (data[0].password != pass) {
          sock.emit('login_ret', 1, '用户名或密码有误');
        } else {
          //3.改在线状态
          db.query(`UPDATE user_table SET online=1 WHERE ID=${data[0].ID}`, err => {
            if (err) {
              sock.emit('login_ret', 1, '数据库有误');
            } else {
              sock.emit('login_ret', 0, '登录成功');
              cur_username = user;
              cur_userID = data[0].ID;
            }
          });
        }
      });
    }
  });

  //离线
  sock.on('disconnect', () => {
    db.query(`UPDATE user_table SET online=0 WHERE ID=${cur_userID}`, err => {
      if (err) {
        console.log('database error', err);
      }
      cur_username = '';
      cur_userID = 0;
    });
  });
});