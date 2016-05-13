var express = require('express'),
    bodyParser = require('body-parser'),
    exec = require("child_process").exec,
		http = require('http'),
		config = require('./config'),
		fs = require('fs'),
		accessLogfile = fs.createWriteStream('./logs/access.log', {flags: 'a'}),
		errorLogfile = fs.createWriteStream('./logs/error.log', {flags: 'a'}),
		async = require('async'),
		app = express();
//日志
app.set('port', process.env.PORT || config.port);

app.use(bodyParser.urlencoded({
	extended: true
}));

app.post(config.webpath, function (req, res, next) {
		var hook = JSON.parse(req.body.hook);
		var project = req.query.project;

		var pusher = {"name":hook.push_data.user.name,"email":hook.push_data.user.email}
        ,id = hook['push_data'].commits[0].id
        ,action = hook.hook_name;
        accessLogfile.write(`${new Date()} -- 提交人：${pusher.name} -- 执行：${action}  -- 任务id：${id}\n`);

				var project = checkProject(project);
				if(!checkPusher(project, pusher)){
					ThrowError("用户认证失败");
          return ;
					res.send(500);
				};
				if(project.password!=hook.password){
					ThrowError("密码错误失败");
          return ;
					res.send(500);
				}
        exec(project.commands.join(' && '), function(err, out, code) {
          if (err instanceof Error) {
    	      ThrowError(err.message);
            return ;
            res.send(500);
          }
          accessLogfile.write(`${new Date()} -- 提交人：${pusher.name} -- 执行：${action}  -- 任务id：${id} -- 状态：成功\n`);
        })
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
  if (project.pusher.length > 0){
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

http.createServer(app).listen(app.get('port'), function(){
  console.log('服务器启动成功监听端口:' + app.get('port'));
});
