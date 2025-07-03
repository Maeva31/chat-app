// Update user list
socket.on('user list', function(users) {
    const usersList = document.getElementById("users");
    usersList.innerHTML = '';
    users.forEach(function(user) {
      const userItem = document.createElement("li");
      
      const genderSquare = document.createElement("span");
      genderSquare.className = "gender-square";
      if (user.gender === "male") {
        genderSquare.style.backgroundColor = "#6495ED"; // Blue color for male users
      } else if (user.gender === "female") {
        genderSquare.style.backgroundColor = "#FFC0CB"; // Pink color for female users
      }
  
      const ageSpan = document.createElement("span");
      ageSpan.textContent = user.age;
      ageSpan.style.color = "#000"; // Black color for age text
      genderSquare.appendChild(ageSpan); // Append age to gender square
  
      const usernameSpan = document.createElement("span");
      usernameSpan.textContent = user.username;
  
      userItem.appendChild(genderSquare);
      userItem.appendChild(usernameSpan);
  
      usersList.appendChild(userItem);
    });
  });
  