/*----------------------Librerias de Frameworks----------------------*/
var express = require("express"); //Importamos la libreria Express
var bodyParser = require("body-parser"); //Importamos la libreria Body Parser para leer parametros
var session = require("express-session"); //Librería que nos permite el uso de sesiones
var router_users = require("./routes"); //Rutas de un usuario logeado
var validation_middleware = require("./middlewares/session"); //Middleware que valida
const {spawn} = require('child_process'); //libreria necesaria para ejecutar scripts en python

/*-----------------------Datos de MongoDB----------------------------*/
var User = require("./model/user").User;

/*-----------------------Definiciones del servidor--------------------*/
var app = express(); //Declaramos nuestra app principal como express
//Se declara que la App podra extraer parametros
app.use(bodyParser.json()) //Formato JSON/
app.use(bodyParser.urlencoded({extended: true}))//Encoded
app.use(express.static('public')); //Se definen los recursos estaticos (Recursos externos al código)
app.set("view engine", "jade"); //Declaramos que sea un motor de vistas y que usaremos JADE
app.use(session({secret: "f156e7995d521f30e6c59a3d6c75e1e5"})); //Palabra secreta para sesiones
//Oscar en MD5 = f156e7995d521f30e6c59a3d6c75e1e5

/*-------------------Interactuando con momngodb------------------*/
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";


/*----------------------Métodos del servidor----------------------------*/


/*----------------------Métodos que renderizan--------------------------*/
app.get("/", function(req,res){ //Metodo GET, la diagonal invertida representa la página principal

    if(String(req.session.user_id) == "undefined"){

        res.render("index");

    } else{

        res.redirect("/users/");
    }

});

app.get("/login", function(req,res){ //Metodo GET que se invocara cuando entre la directiva Login

    res.render("login");

});

app.get("/wrong_login", function(req,res){ //Metodo GET que se invocara cuando entre la directiva Login

    res.render("wrong_login");

});

app.get("/new_user", function(req,res){ //Metodo GET que se invocara cuando entre la directiva Login

    res.render("new_user");

});

app.get("/nuevo_agente", function(req,res){ //Metodo GET, la diagonal invertida representa la página principal

    if(String(req.session.user_id) == "undefined"){

        res.redirect("/");

    } else {
        res.render("users/nuevo_agente");
    }

});


app.get("/agentes", function(req,res){ //Metodo GET, la diagonal invertida representa la página principal
    if (String(req.session.user_id) == "undefined") {
        res.redirect("/");
    } else{
      MongoClient.connect(url, function(err, db) {
        if (err) throw err;
        var dbo = db.db("MonitorRed");
        collection = dbo.collection("AgentesSNMP");
        collection.find({}).toArray((error, result) => {
          if(error) {
              return response.status(500).send(error);
          }
          res.json(result);
        });
      });
    }
});

app.get("/admin_agentes", function(req,res){ //Metodo GET, la diagonal invertida representa la página principal
    if (String(req.session.user_id) == "undefined") {
        res.redirect("/");
    } else{
      MongoClient.connect(url, function(err, db) {
        if (err) throw err;
        var dbo = db.db("MonitorRed");
        collection = dbo.collection("AgentesSNMP");
        collection.find({}).toArray((error, result) => {
          if(error) {
              return response.status(500).send(error);
          }
          console.log(result.length);
          if (result.length === 0) {
            res.render('users/sin_agentes');
          } else {
            res.render("users/mostrar_agentes");
          }
        });
      });

    }
});

/*----------------------Métodos de funcionalidad (HTTP)------------------------*/

//Registro de nuevo ip_agente
app.post("/nuevo_agente", function(req,res){ //Metodo POST para parametros que se invocara con la directiva users
  // spawn new child process to call the python script
  const python = spawn('python', ['snmp/snmpGet.py',
                                  req.body.agente.ip,
                                  req.body.agente.community]
                      );
  // collect data from script
  var agente;
  python.stdout.on('data', function (data) {
    console.log('Pipe data from python script ...');
    console.log(data.toString())
    dataToSend = data.toString();
  });
  // in close event we are sure that stream from child process is closed
  python.on('close', (code) => {
    console.log(`child process close all stdio with code ${code}`);
    if (code === 0) {
      //send json with agent info
      var data = require('./agentinfo.json');
      res.json(data);
      //res.end("it worked!");
    } else {
      res.status(500).send('showAlert');
    }



    /*
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("MonitorRed");
      var myobj = { ip: req.body.agente.ip, comunidad: req.body.agente.community };
      //var myobj = req;
      dbo.collection("AgentesSNMP").insertOne(myobj, function(err, res) {
        if (err) throw err;
        console.log("1 document inserted");
        db.close();
      });
    });
    */




    //res.render("mostrar_agentes")
    //res.status(500).send('showAlert');

  });
});

//Guardar Agente en MongoDB
app.post("/guardar_agente", function(req, res) {
  MongoClient.connect(url, function(err, db) {
    if (err) {
      throw err;
      res.status(500).send('showAlert');
    }
    var dbo = db.db("MonitorRed");
    var myobj = { ip: req.body.agente.ip, comunidad: req.body.agente.community };
    //var myobj = req;
    dbo.collection("AgentesSNMP").insertOne(myobj, function(err, res) {
      if (err) {
        throw err;
        res.status(500).send('showAlert');
      }
      console.log("1 document inserted");
      db.close();
    });
    res.redirect('/admin_agentes');
  });
});

//Registro de usuarios
app.post("/register", function(req,res){ //Metodo POST para parametros que se invocara con la directiva users

    var user = new User({
        Nombre: req.body.Nombre,
        Password: req.body.Password,
        Email: req.body.Email
    });

    //function(error,obj,numero)
    user.save(function(err,obj){
        if(err != null){
            console.log(String(err));
            res.redirect('/new_user');
        }else{
            console.log("Usuario se a registrado");
            console.log(obj);
            res.redirect('/'); //Redirecciona como HTTP
        }
    });

});

//Login de usuarios
app.post("/sign", function(req,res){  //Metodo Para desplegar la base

    console.log("Verificando Entrada de Usuario");
    //Query, Fields, Callback
    User.find({Email: req.body.Email, Password: req.body.Password},function(err,doc){

        if(Object.entries(doc).length === 0){

            console.log("El usuario que intento ingresar no estaba registrado");
            res.redirect("/wrong_login");

        } else{
            console.log("Ingreso al sistema el usuario: " + doc[0].Email);
            console.log("Creando sesión");
            req.session.user_id = doc[0]._id;
            console.log("Sesión creada:"+req.session.user_id);
            res.redirect("/users/");
        }
    }); //Devuelve una arreglo de documentos
});

//Verificación de sesión
app.get("/logout", function(req,res){
    req.session.destroy();
    res.redirect("/");
});

/*---------------------Rutas y Middlewares-----------------------------------------*/

app.use("/users", validation_middleware); //Middlewares
app.use("/users", router_users); //Rutas
//Handles no specified routes
app.use(function(req, res, next){
  res.status(404);
  res.render("no_encontrada");
});

app.listen(8080); //Puerto de escucha
