#!/usr/bin/env node

const program = require('commander');
const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  URL
} = require('url');

const exts = ['.jpg', '.png']
const max = 5200000; // 5MB == 5242848.754299136
/**
 * panda-cli
 * -f src/images/  参数 逗号分隔的多个文件夹，
 */
program
  .version('0.1.0')
  .option('-f, --folders <items>', '图片根目录 | images root path', folders)
  .parse(process.argv);

/**
 * 源文件夹副本是否存在？
 * 存在？操作源文件夹副本内的图片 压缩输出到
 * 不存在？创建源文件夹副本，操作源文件夹副本内的图片
 */


/**
 * 获取文件夹列表
 * @param {string} str 
 */
function folders(str) {
  console.log('图片根目录 : %s', str);
  let arr = str.split(',');
  arr.forEach(f => {
    let tmp = f.split('/').filter(i => i);
    f = tmp.join('/') + '/'; // 真实路径
    tmp[tmp.length - 1] = '.' + tmp[tmp.length - 1];
    tmp = tmp.join('/') + '/'; // 副本路径
    readFile(f, tmp)
  });
}

/**
 * 读取文件或者文件夹
 * @param {string} realPath 
 * @param {string} tempPath 
 */
function readFile(realFolder, tempFolder) {
  console.log(realFolder, tempFolder);
  fs.readdir(realFolder, (err, files) => {
    if (err) console.error(err);
    files.forEach(file => {
      let realPath = realFolder + file;
      let tempPath = tempFolder + file;
      fs.stat(realPath, (err, stats) => {
        if (err) return console.error(err);
        if (
          // 必须是文件，小于5MB，后缀 jpg||png
          stats.isFile() &&
          stats.size <= max &&
          exts.includes(path.extname(realPath))
        ) {
          fs.exists(tempPath, bool => {
            if (!bool) {
              console.log('图片 %s 没有压缩过，建立图片副本 %s', realPath, tempPath)
              if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder)
              fs.copyFileSync(realPath, tempPath)
              fileUpload(realPath)
            } else {
              console.log('图片 %s 压缩过，存在图片副本 %s', realPath, tempPath)
            }
          })
        }
        if (stats.isDirectory()) arguments.callee(realPath + '/', tempPath + '/');
      });
    });
  });
}
/**
 * 异步API,压缩图片
 * {"error":"Bad request","message":"Request is invalid"}
 * {"input": { "size": 887, "type": "image/png" },"output": { "size": 785, "type": "image/png", "width": 81, "height": 81, "ratio": 0.885, "url": "https://tinypng.com/web/output/7aztz90nq5p9545zch8gjzqg5ubdatd6" }}
 */

function fileUpload(img) {
  let options = {
    method: 'POST',
    hostname: 'tinypng.com',
    path: '/web/shrink',
    headers: {
      rejectUnauthorized: false,
      'Postman-Token': Date.now(),
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
    }
  };
  let req = https.request(options, function (res) {
    res.on('data', buf => {
      let obj = JSON.parse(buf.toString());
      if (obj.error) {
        console.log('%s： 压缩失败,错误信息：%s', img, obj.message)
      } else {
        fileUpdate(img, obj);
      }
    });
  });

  req.write(fs.readFileSync(img), 'binary');
  req.on('error', e => console.error(e));
  req.end();
}


// 该方法被循环调用,请求图片数据
function fileUpdate(imgpath, obj) {
  let req = https.request(new URL(obj.output.url), res => {
    let body = '';
    res.setEncoding('binary');
    res.on('data', data => body += data);
    res.on('end', () => {
      fs.writeFile(imgpath, body, 'binary', err => {
        if (err) return console.error(err);
        console.log('%s 压缩成功，原始大小 %s , 压缩后大小 %s , 压缩比 %s ', imgpath, obj.input.size, obj.output.size, obj.output.ratio);
      });
    });
  });

  req.on('error', e => console.error(e));
  req.end();
}