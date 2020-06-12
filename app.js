/*----------------------Librerias de Frameworks----------------------*/
var express = require("express"); //Importamos la libreria Express
var bodyParser = require("body-parser"); //Importamos la libreria Body Parser para leer parametros
var session = require("express-session"); //Librería que nos permite el uso de sesiones
var router_users = require("./routes"); //Rutas de un usuario logeado
var validation_middleware = require("./middlewares/session"); //Middleware que valida
var nodemailer = require('nodemailer');
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


//var jsonagente = require('./agentinfo.json')
var fs = require('fs');


//--------------------------------opciones de alertas----------------------
var lim_memoria;
var lim_cpu;
var lim_disco;
var lim_anchoBanda;
var not_again = [];
//-------------------------------nodemailer--------------------------------
//process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var user_email;
var transporter = nodemailer.createTransport({
  host: "correo.equipo1.com",
  port: 25,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'monitor@equipo1.com', // generated ethereal user
    pass: '330.87m16monitor', // generated ethereal password
  },
  tls: {
    rejectUnauthorized: false
  }
});


function enviarAlerta(ip, nombre, mensajes, date) {
  var asunto = "Monitor de Red: Alerta en " + nombre;
  var contenido = "<center style='color:red'><h4>Alerta de monitoreo de red</h4></center>"
                + "<i>"
                + "Equipo: " + nombre + "<br>"
                + "IP: " + ip + "<br>"
                + "fecha y hora: " + date + "<br>"
                + "</i><ul>";
  for (var i = 0; i < mensajes.length; i++) {
    contenido += "<li>" + mensajes[i] + "</li>";
  }
  contenido += "</ul><center><img src='cid:unique@cid'></center>";
  var mailOptions = {
    from: 'monitor@equipo1.com',
    to: user_email,
    subject: asunto,
    //text: contenido,
    html: contenido,
    attachments: [{
          filename: 'icon1_sm.png',
          path: __dirname + '/public/images/icon1.png',
          cid: 'unique@cid'
      }],
  };
  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}


/*----------------------Métodos del servidor----------------------------*/

async function updateOptions() {
  MongoClient.connect(url, function(err, db) {
    if (err) throw err;
    var dbo = db.db("MonitorRed");
    collection = dbo.collection("alertas");
    collection.find({}).toArray((error, result) => {
      if(error) {
        console.log("ERROR AL ACTUALIZAR LAS OPCIONES DE ALERTAS");
        return;
      }
      if (result.length == 0) {
        console.log("ERROR: NO HAY OPCIONES DE ALERTAS EN LA BASE DE DATOS");
        return;
      }
      lim_memoria = result[0]["memoria"];
      lim_cpu = result[0]["cpu"];
      lim_disco = result[0]["disco"];
      lim_anchoBanda = result[0]["anchoBanda"];
      console.log("Opciones de alertas actualizadas");
    });
  });
}

async function checkLimit2(ip, nombre) {
  return new Promise(function(resolve, reject) {
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("MonitorRed");
      collection = dbo.collection("resourcesUtil");
      collection.find({"agente":ip})
        .sort({_id:-1})
        .limit(1)
        .toArray((error, resultado) => {
        if(error) {
            console.log("HUBO UN ERROR AL OBTENER EL ULTIMO DOCUMENTO DEL AGENTE" + ip);
            resolve();
        }
        if (resultado.length == 0) {
          console.log("ERROR, NO HAY REGISTROS DEL AGENTE " + ip);
          resolve();
          return;
        }
        console.log("again with "  + ip);
        var memoria = resultado[0]["memoria"];
        var cpu = resultado[0]["cpu"];
        var disco;
        var anchoBanda = [];

        var mensajes = [];
        var send_email = false;

        console.log(memoria);
        console.log(cpu);

        if (resultado[0].hasOwnProperty('disco')) {
          disco = resultado[0]["disco"];
          console.log(disco);
        }
        for (var i = 0; i < resultado[0].anchoBanda.length; i++) {
          anchoBanda.push(resultado[0].anchoBanda[i]);
        }
        for (var i = 0; i < anchoBanda.length; i++) {
          console.log(anchoBanda[i]);
        }

        if (memoria > lim_memoria) {
          send_email = true;
          mensajes.push("Uso de memoria: " + memoria + "%. Ha rebasado el " + lim_memoria + "%.");
        }
        if (cpu > lim_cpu) {
          send_email = true;
          mensajes.push("Carga del CPU: " + cpu + ". Ha rebasado el valor de " + lim_cpu + ".");
        }
        if (disco != null) {
          if (disco > lim_disco) {
            send_email = true;
            mensajes.push("Uso de almacenamiento: " + disco + "%. Ha rebasado el " + lim_disco + "%.");
          }
        }

        for (var x = 0; x < anchoBanda.length; x++) {
          if (anchoBanda[x].utilizacion > lim_anchoBanda) {
            send_email = true;
            mensajes.push("Utilización del ancho de banda en "
                          + anchoBanda[x].ifDescr + ": " + anchoBanda[x].utilizacion
                          + ". Ha rebasado el valor de " + lim_anchoBanda + ".");
          }
        }

        for (var i = 0; i < not_again.length; i++) {
          if (not_again[i]["ip"] == ip) {
            if (not_again[i]["date"] == resultado[0]["date"]) {
              send_email = false;
            }
          }
        }
        console.log("###########      " + not_again.length + "         ############");
        if (send_email) {
          if (not_again.length == 0) {
            not_again.push({
              ip: ip,
              date: resultado[0]["date"]
            });
          } else {
            var updated = false;
            for (var x = 0; x < not_again.length; x++) {
              if (not_again[x]["ip"] == ip) {
                updated = true;
                not_again[x]["date"] = resultado[0]["date"];
              }
            }
            if (!updated) {
              not_again.push({
                ip: ip,
                date: resultado[0]["date"]
              });
            }
          }
          console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
          enviarAlerta(ip, nombre, mensajes, resultado[0]["date"]);
        }

        //obtener informacion de cada recurso
        resolve();

      });
    });
  });
}

async function checkLimit() {
  return new Promise(function(resolve, reject) {
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("MonitorRed");
      collection = dbo.collection("AgentesSNMP");
      collection.find({}).toArray(async function (error, result) {
        if(error) {
            console.log("HUBO UN ERROR AL OBTENER LOS AGENTES");
            resolve();
        }

        for (var i = 0; i < result.length; i++) {
          var ip = result[i]["ip"];
          var nombre = result[i]["nombre"];
          console.log("-----------------Información de " + nombre + ", " + ip);


          //Buscar el ultdimo documento del uso de recursos para el agente actual
          await checkLimit2(ip, nombre);


        }//fin for (result.length)
        resolve();
      });
    });
  });
}

function pythonScript(script, ip, nombre, comunidad) {
  const python = spawn('python', [script,
                                  ip,
                                  comunidad]);

  python.on('close', (code) => {
    console.log(`child process close all stdio with code ${code}`);
    if (code === 0) {
      console.log("everything ok with " + nombre);
    } else {
      console.log("somethig went wrong with the python script: " + nombre);
      var fecha = new Date().toLocaleString();
      var mensajes = ["El agente SNMP no ha respondido en el tiempo límite"];
      enviarAlerta(ip, nombre, mensajes, fecha);
    }
    //resolve();
  });
}

async function snmpTask() {
  //Nos conectamos a la base de datos para buscar los agentes
  return new Promise(function(resolve, reject) {

    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("MonitorRed");
      collection = dbo.collection("AgentesSNMP");
      collection.find({}).toArray((error, result) => {
        if(error) {
            console.log("Error al buscar agentes snmp");
            resolve();
        }
        for (var i = 0; i < result.length; i++) {
          //preparamos los datos del agente y el nombre del script

          var nombre = result[i]["nombre"];
          console.log(nombre);
          var ip = result[i]["ip"];
          var comunidad = result[i]["comunidad"];
          var descripcion = result[i].descripcion;
          var primeraPalabra = descripcion.substr(0, descripcion.indexOf(" "));
          var script = "";
          if (primeraPalabra == "Linux") {
            script = "snmp/snmpResUsageUbuntu.py";
          } else if (primeraPalabra = "Cisco") {
            script = "snmp/snmpResUsageCisco.py";
          } else {
            console.log("Tipo de sistema desconocido");
            resolve();
          }
          console.log(ip);
          console.log(comunidad);
          console.log("script a usar: " + script);

          //ejecución del script para el agente actual
          pythonScript(script, ip, nombre, comunidad);



        }
        resolve();
      });
    });
  });
}

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


app.get("/agentes", function(req, res) { //Metodo GET, la diagonal invertida representa la página principal
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


app.get("/umbrales", function(req, res) { //Metodo GET, la diagonal invertida representa la página principal
    if (String(req.session.user_id) == "undefined") {
        res.redirect("/");
    } else{
      MongoClient.connect(url, function(err, db) {
        if (err) throw err;
        var dbo = db.db("MonitorRed");
        collection = dbo.collection("alertas");
        collection.find({}).toArray((error, result) => {
          if(error) {
              return response.status(500).send(error);
          }
          res.json(result);
        });
      });
    }
});


app.get("/admin_agentes", function(req, res) { //Metodo GET, la diagonal invertida representa la página principal
    if (String(req.session.user_id) == "undefined") {
        res.redirect("/");
    } else {
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

app.get("/monitor", function(req,res){ //Metodo GET, la diagonal invertida representa la página principal
    if (String(req.session.user_id) == "undefined") {
        res.redirect("/");
    } else {
      MongoClient.connect(url, function(err, db) {
        if (err) throw err;
        var dbo = db.db("MonitorRed");
        collection = dbo.collection("AgentesSNMP");
        collection.find({}).toArray((error, result) => {
          if (error) {
              return res.status(500).send(error);
          }
          if (result.length === 0) {
            res.render('users/sin_agentes');
          } else {
            res.render("users/monitor");
          }
        });
      });
    }
});


app.get("/opciones_alertas", function(req, res) { //Metodo GET, la diagonal invertida representa la página principal
    if (String(req.session.user_id) == "undefined") {
        res.redirect("/");
    } else {
        res.render("users/opciones");
    }
});

app.post("/sendmail", function(req, res) {
  if (String(req.session.user_id) == "undefined") {
      res.redirect("/");
  } else {
    console.log("email: " + user_email + " ?");
    var mailOptions = {
      from: 'monitor@equipo1.com',
      to: user_email,
      subject: 'Sending Email using Node.js',
      text: 'That was easy!'
    };
    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(error);
        res.status(500).send(error);
      } else {
        console.log('Email sent: ' + info.response);
        res.end("OK");
      }
    });
  }
});




app.post("/cambiar_opciones", function(req, resp) {
  if (String(req.session.user_id) == "undefined") {
      res.redirect("/");
  } else {
    //console.log(req.body.agente)

    MongoClient.connect(url, function(err, db) {
      if (err) {
        throw err;
        res.status(500).send('showAlert');
      }
      var dbo = db.db("MonitorRed");
      var myobj = {
                    memoria: req.body.memoria,
                    cpu: req.body.cpu,
                    disco: req.body.disco,
                    anchoBanda: req.body.anchoBanda
                  };
      //var myobj = req;
      dbo.collection("alertas").deleteOne({});
      dbo.collection("alertas").insertOne(myobj, function(err, res) {
        if (err) {
          throw err;
          res.status(500).send('showAlert');
        }
        console.log("1 document inserted");
        db.close();
        updateOptions();
        resp.end("OK");
      });

    });

  }
});



app.post("/resourcesUtil", function(req, res) {
  if (String(req.session.user_id) == "undefined") {
      res.redirect("/");
  } else {
    console.log(req.body.agente)
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("MonitorRed");
      collection = dbo.collection("resourcesUtil");
      collection.find({"agente":req.body.agente}) //ip del agente
        .sort({_id:-1})
        .limit(10)
        .toArray((error, result) => {
        if(error) {
            return response.status(500).send(error);
        }
        console.log("enviando resourcesUtil del agente");
        res.json(result);
      });
    });
  }
});

//se llama para ejecutar un script de snmp y devolver un nuevo json
app.post("/newResourcesUtil", function(req, res) {

  if (String(req.session.user_id) == "undefined") {
    res.redirect("/");
  } else {
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("MonitorRed");
      collection = dbo.collection("resourcesUtil");
      collection.find({"agente":req.body.agente})
        .sort({_id:-1})
        .limit(1)
        .toArray((error, result) => {
        if(error) {
            return response.status(500).send(error);
        }
        console.log("enviando resourcesUtil (last) del agente");
        res.json(result);
      });
    });
  }
});


/*app.post("/newResourcesUtil", function(req, res) {

  if (String(req.session.user_id) == "undefined") {
      res.redirect("/");
  } else {
    console.log(req.body.agente);
    //obtener ip y comunidad del agente
    //ip = req.body.agente;
    comunidad = "";

    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("MonitorRed");
      collection = dbo.collection("AgentesSNMP");
      collection.find({"ip":req.body.agente})
        .limit(1)
        .toArray((error, result) => {
        if(error) {
            console.log("there was an error in find()");
            return res.status(500).send(error);
        }
        console.log("se encontró la comunidad del agente: " + result[0].comunidad);
        comunidad = result[0].comunidad;
        descripcion = result[0].descripcion;
        primeraPalabra = descripcion.substr(0, descripcion.indexOf(" "));
        script = "";
        if (primeraPalabra == "Linux") {
          script = "snmp/snmpResUsageUbuntu.py";
        } else if (primeraPalabra = "Cisco") {
          script = "snmp/snmpResUsageCisco.py";
        } else {
          console.log("Tipo de sistema desconocido");
          res.status(500).send('showAlert');
        }

        console.log("ip = " + req.body.agente);
        console.log("comunidad = " + comunidad);
        //ejecutar script snmp

        const python = spawn('python', [script,
                                        req.body.agente,
                                        comunidad]);

        python.stdout.on('data', function (data) {
          console.log('Pipe data from python script ...');
          console.log(data.toString())
          dataToSend = data.toString();
        });
        // in close event we are sure that stream from child process is closed
        python.on('close', (code) => {
          console.log(`child process close all stdio with code ${code}`);
          if (code === 0) {


            MongoClient.connect(url, function(err, db) {
              if (err) throw err;
              var dbo = db.db("MonitorRed");
              collection = dbo.collection("resourcesUtil");
              collection.find({"agente":req.body.agente})
                .sort({_id:-1})
                .limit(1)
                .toArray((error, result) => {
                if(error) {
                    return response.status(500).send(error);
                }
                console.log("enviando resourcesUtil (last) del agente");
                res.json(result);
              });
            });
          } else {
            console.log("somethig went wrong with the python script");
            res.status(500).send('showAlert');
          }
          //res.render("mostrar_agentes")
          //res.status(500).send('showAlert');

        });

      });
    });


  }
});*/




/*----------------------Métodos de funcionalidad (HTTP)------------------------*/

//Registro de nuevo ip_agente
app.post("/nuevo_agente", function(req,res){ //Metodo POST para parametros que se invocara con la directiva users
  // spawn new child process to call the python script
  const python = spawn('python', ['snmp/snmpGet.py',
                                  req.body.agente.ip,
                                  req.body.agente.community]
                      );
  // collect data from script
  //var agente;
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
      //agente = require('./agentinfo.json');


      fs.readFile('./agentinfo.json', (err, data) => {
        if (err) throw err;
        let agente = JSON.parse(data);
        console.log(agente);
        res.json(agente);
      });


      //res.json(jsonagente);
      //res.end("it worked!");
    } else {
      res.status(500).send('showAlert');
    }
    //res.render("mostrar_agentes")
    //res.status(500).send('showAlert');

  });
});

//eliminar un agente
app.post("/borrar_agente", function(req,res){ //Metodo POST para parametros que se invocara con la directiva users
  MongoClient.connect(url, function(err, db) {
    if (err) {
      throw err;
      res.status(500).send('showAlert');
    }
    //console.log("trying to remove" + req.body.agente)
    var dbo = db.db("MonitorRed");
    dbo.collection("AgentesSNMP").deleteOne({ip: req.body.agente},
      function(err, res) {
      if (err) {
        throw err;
        res.status(500).send('showAlert');
      }
      console.log("1 document deleted");
      db.close();
    });
    res.end('OK');
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
    var myobj = {
                  nombre: req.body.agente.nombre,
                  ip: req.body.agente.ip,
                  descripcion: req.body.agente.descripcion,
                  comunidad: req.body.agente.comunidad
                };
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
            user_email = req.body.Email;
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

//var minutes = 5, the_interval = minutes * 60 * 1000;

//snmpTask();
//setInterval(snmpTask, 30000);
//function sleep(ms) {
//  return new Promise(resolve => setTimeout(resolve, ms));
//}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function demo() {
  // Sleep in loop
  await updateOptions();
  for (;;) {
    await snmpTask();
    await sleep(30000);
    console.log("SNMP SCRIPTS EXECUTION FINISHED");
    await checkLimit();
    await sleep(270000);
    console.log("5 MINUTES TIMEOUT REACHED");
  }
}
demo();

app.listen(80); //Puerto de escucha
