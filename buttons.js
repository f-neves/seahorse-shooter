const buttonUp = document.querySelector('.buttonUp')
const buttonDown = document.querySelector('.buttonDown')
const buttonShoot = document.querySelector('.buttonShoot')

buttonUp.addEventListener('touchstart', () => {
  keys.w.pressed = true        

})

buttonUp.addEventListener('touchend', () => {
  keys.w.pressed = false
})

buttonDown.addEventListener('touchstart', () => {
  keys.s.pressed = true  
})

buttonDown.addEventListener('touchend', () => {
  keys.s.pressed = false
})

buttonShoot.addEventListener('touchstart', () => {
  if(player.velocity.y === 0)
  player.velocity.y = -5
})

