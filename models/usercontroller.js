const validator = require('validator');
const mongoose=require('mongoose')
var jwt = require('jsonwebtoken');
const userschema=new mongoose.Schema({
    username : String,
    email:String,
    password:String,
    coins: { type: Number, default: 0 },
})
const usermodel=mongoose.model('users',userschema)

module.exports = usermodel;
module.exports.signup=(req,res)=>{
    const username=req.body.name;
    const email=req.body.email;
    const password=req.body.password;
    console.log(req.body)
    

    if (!username || !password||!email) {
      res.send({ message: 'All fields are required' });
      return;
  }
    if (!username || username.length < 4) {
      res.send({ message: 'Username must be at least 4 characters long' });
      return;
  }
  const allowedDomains = [
    '@gmail.com',
    '@yahoo.com',
    '@outlook.com',
    '@hotmail.com'
  ];
  
  if (
    !validator.isEmail(email) ||
    !allowedDomains.some(domain => email.endsWith(domain))
  ) {
    res.send({ message: 'Enter email with proper format' });
    return;
  }
  
    if (!password || password.length < 6) {
       res.send({ message: 'Password must be at least 6 characters long' });
       return
  }
    const user = new usermodel({ username: username,password:password,email:email,coins:0});
    user.save().then(() => {
      res.send({ message: 'saved success'})
    })
    .catch(()=>{
      res.send({ message:'server error'})
    })
  }
  module.exports.login = (req, res) => {
    console.log(req.body);
    const username = req.body.name;
    const password = req.body.password;
  
    usermodel.findOne({ username: username })
      .then((result) => {
        console.log(result, 'user data');
        if (!result) {
          return res.send({ message: 'user not found' });
        }
  
        if (result.password === password) {
          const token = jwt.sign({ data: result }, 'MYKEY', { expiresIn: '1h' });
          return res.send({
            message: 'login success',
            token: token,
            userId: result._id,
            username: result.username
          });
        } else {
          return res.send({ message: 'password not matched' });
        }
      })
      .catch((err) => {
        console.error(err);
        res.send({ message: 'server error' });
      });
  };
  
  module.exports.getcoins = (req, res) => {
    const userId = req.params.userId;
    usermodel.findById(userId)
        .then((result) => {
            if (result) {
                res.send({ message: "success", coin: result.coins });
            } else {
                res.status(404).send({ message: 'User not found' });
            }
        })
        .catch((err) => {
            res.status(500).send({ message: 'Server error' });
        });
};
module.exports.getLeaderboard = (req, res) => {
  usermodel.find().sort({ coins: -1 })
    .then((result) => {
      res.send({ leaderboard: result });
    })
    .catch((err) => {
      res.send({ message: 'Server error' });
    });
};
