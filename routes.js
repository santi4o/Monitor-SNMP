var express = require("express");

var router = express.Router();

//localhost:8080/users/
router.get("/",function(req,res){

    res.render("users/home");

});

router.get("nuevo_agente",function(req,res){

    res.render("users/nuevo_agente");

});

router.get("mostrar_agentes",function(req,res){

    res.render("users/mostrar_agentes");

});


module.exports = router;
