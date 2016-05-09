var express = require('express'),
	bodyParser = require('body-parser'),
    exec = require("child_process").exec,
	http = require('http'),
	config = require('./config');
	app = express();

var password = '123'; //提交密码
var releasewords = 'release'; //发布关建字

//日志
var fs = require('fs'),
accessLogfile = fs.createWriteStream('./logs/access.log', {flags: 'a'}),
errorLogfile = fs.createWriteStream('./logs/error.log', {flags: 'a'});


// all environments
app.set('port', process.env.PORT || 8080);

app.use(bodyParser.urlencoded({
	extended: true
}));

app.post('/', function (req, res, next) {
		var hook = JSON.parse(req.body.hook);
		var project = JSON.parse(req.query.project);

		var pusher = {"name":hook.user.name,"email":hook.user.email}
        ,id = hook['push_data'].commits.id
        ,action = hook.hook_name;
        accessLogfile.write(`${new Date()} -- 提交人：${pusher.name} -- 执行：${action}  -- 任务id：${id}\n`);
        var project = checkProject(project);
        var isy = checkPusher(project, pusher);
        if(isy){
          exec(project.commands.join(' && '), function(err, out, code) {
            if (err instanceof Error) {
      	      ThrowError(err.message);
            }
            accessLogfile.write(`${new Date()} -- 提交人：${pusher.name} -- 执行：${action}  -- 任务id：${id} -- 状态：成功\n`);
            process.stderr.write(err)
            process.stdout.write(out)
          })
        }
				res.send(200)
})

function checkProject(projectName){
  if (typeof projectName != 'string')
    ThrowError('url没有添加项目名称');

  if (typeof config.projects[projectName] != 'object')
     ThrowError('没有配置项目')
  if  (typeof config.projects[projectName].commands != 'object')
    ThrowError('没有配置项目执行命令')
  return config.projects[projectName];
}

function  checkPusher(project, pusher){
  if (typeof project != 'object')
    ThrowError('没有配置项目')
  if (typeof project.pusher != 'object')
    ThrowError('没有配置提交者')
  if (typeof project.pusher.length > 0){
    var result =  _.findIndex(project.pusher,pusher);
    if(result<0){
      return false;
    }
  }
  return true;
}

function ThrowError(message){
    errorLogfile.write(`${new Date()} -- Error：${message} \n`,function(){
      throw new TypeError(message);
    });
}

app.post('/deploy/', function (req, res) {
	var hook = JSON.parse(req.body.hook);
    var now = new Date();
    var time = now.getFullYear() + '-' + now.getMonth() + '-' + now.getDate() + ' '
        + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();

	if(hook.password != password){
		res.json(200, {message: 'password fail'});
	}else{
        var lastcommit = hook.push_data.commits[hook.push_data.commits.length -1];
        console.log(lastcommit ,lastcommit.message.indexOf(releasewords));
        if(lastcommit.message.indexOf(releasewords) >= 0)//这里意为：如果最后的commit包含"release"则进行自动发布。
        {
            exec('sh ./deploy.sh ' + req.query.p,function(error, stdout, stderr){console.log(error, stdout, stderr);});
            accessLogfile.write('release for Projecp' + req.query.p + time +  ' ' + lastcommit.message+  ' ' + lastcommit.author.name + '\n');
            res.json(200, {message: 'Git Hook received!'});
        }else{
            accessLogfile.write('Skip release ' + time +  ' ' + lastcommit.message+  ' ' + lastcommit.author.name + '\n');
            res.json(200, {message: 'Skip release'});
        }
	}
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
