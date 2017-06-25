(function () {
    var CANVAS = document.getElementById('gameCanvas');
    var CTX = CANVAS.getContext('2d');
    var TIMESTEP = 10; // How finely the state is interpolated between frames. Higher = choppier.
	var HUD_HEIGHT = 80;
	var MINIMAP_SCALE = 30;
	var MAX_DISTANCE = 1500;
	var mmLeft = CANVAS.width / 2 - HUD_HEIGHT / 2;
    var timeDelta = 0;
	var MAX_TIME_DELTA = 1000; // less than 1 fps is not worth interpolating
	var SHOOTER_RADIUS = 17;
	var BOSS_RADIUS = 100;
    var lastFrameTimestamp = 0;
    var entities = [];
    var asteroids;
    var asteroidCount = 0;
    var crystals;
    var crystalCount = 0;
	var crystalInd = 0;
    var miners;
    var minerCount = 0;
	var shooters;
	var shooterCount = 0;
	var enemyBullets;
	var enemyBulletCount = 0;
	var enemyBulletInd = 0;
	var playerBullets;
	var playerBulletCount = 0;
	var playerBulletInd = 0;
    var playerRef;
	var bossRef;
	var bossPieces = [];
	var index;
	var entRef;
	var screenX;
	var screenY;
	var MAX_SCREEN_BOUND_X = 100;
	var MAX_SCREEN_BOUND_Y = 50;
	var screenBoundX;
	var screenBoundY;
    function mainLoop(timeStamp) {
        var entIndex;
		var curEnt;
		var mmX; // minimap x, y
		var mmY;
        
        timeDelta += timeStamp - lastFrameTimestamp;
		timeDelta = timeDelta > MAX_TIME_DELTA ? MAX_TIME_DELTA : timeDelta;
        lastFrameTimestamp = timeStamp;
        // Interpolate state updates
        while (timeDelta >= TIMESTEP) {
            for (entIndex = 0; entIndex < entities.length; entIndex++) {
				if (entities[entIndex].active) {
					entities[entIndex].updateState(TIMESTEP);
				}
            }
            timeDelta -= TIMESTEP;
        }
        // Drawing
        CTX.clearRect(0, 0, CANVAS.width, CANVAS.height); // clear the canvas
		// Draw entities
        for (entIndex = 0; entIndex < entities.length; entIndex++) {
			curEnt = entities[entIndex];
			if (curEnt.active) {
				entities[entIndex].draw();
			}
        }
		// Draw HUD
		CTX.fillStyle = "#000090";
		CTX.fillRect(0, 0, CANVAS.width, HUD_HEIGHT);
		CTX.fillStyle = "#000040";
		CTX.fillRect(mmLeft, 0, 80, 80);
		CTX.beginPath();
		CTX.strokeStyle = "#FFFF00";
		// visible distance rectangle
		CTX.rect(mmLeft + HUD_HEIGHT / 2 - (playerRef.x - screenX + CANVAS.width / 2) / MINIMAP_SCALE,
			HUD_HEIGHT / 2 - (playerRef.y - screenY + (CANVAS.height - HUD_HEIGHT) / 2) / MINIMAP_SCALE,
			CANVAS.width / MINIMAP_SCALE,
			(CANVAS.height - HUD_HEIGHT) / MINIMAP_SCALE);
		CTX.stroke();
		// Draw minimap blips
		for (entIndex = 0; entIndex < entities.length; entIndex++) {
			curEnt = entities[entIndex];
			if (!curEnt.active || !curEnt.blipColor) {
				continue;
			}
			mmX = mmLeft + HUD_HEIGHT / 2 - 1 + (curEnt.x - playerRef.x) / MINIMAP_SCALE;
			if (mmX - 1 < mmLeft || mmX + 1 >= mmLeft + HUD_HEIGHT) {
				continue;
			}
			mmY = HUD_HEIGHT / 2 - 1 + (curEnt.y - playerRef.y) / MINIMAP_SCALE;
			if (mmY < 0 || mmY + 1 >= HUD_HEIGHT) {
				continue;
			}
			CTX.fillStyle = curEnt.blipColor;
			CTX.fillRect(mmX, mmY, 2, 2);
		}
        requestAnimationFrame(mainLoop);
    };
    function keyDownHandler(e) {
        switch(e.keyCode) {
            case 38: // up
                playerRef.throttle = true;
                break;
            case 37: // left
                playerRef.angleDelta = .005;
                break;
            case 39: // right
                playerRef.angleDelta = -.005;
                break;
			case 32: // space
				playerRef.shooting = true;
            default:
                break;
        }
    };
    function keyUpHandler(e) {
        switch(e.keyCode) {
            case 38: // up
                playerRef.throttle = false;
                break;
            case 37: // left
            case 39: // right
                playerRef.angleDelta = 0;
                break;
			case 32: // space
				playerRef.shooting = false;
            default:
                break;
        }
    };
    function distance(x0, y0, x1, y1) {
        return Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
    };
	function lineCheck(x1, y1, x2, y2, x3, y3, x4, y4) {
		var a_dx = x2 - x1;
		var a_dy = y2 - y1;
		var b_dx = x4 - x3;
		var b_dy = y4 - y3;
		var s = (-a_dy * (x1 - x3) + a_dx * (y1 - y3)) / (-b_dx * a_dy + a_dx * b_dy);
		var t = (+b_dx * (y1 - y3) - b_dy * (x1 - x3)) / (-b_dx * a_dy + a_dx * b_dy);
		
		return (s >= 0 && s <= 1 && t >= 0 && t <= 1);
	};
	function circleToLineCheck(x1, y1, x2, y2, cX, cY, r) {
		var shiftX1 = x1 - cX;
		var shiftY1 = y1 - cY;
		var shiftX2 = x2 - cX;
		var shiftY2 = y2 - cY;
		var m = (shiftY2 - shiftY1) / (shiftX2 - shiftX1); // slope
		var b = shiftY1 - m * shiftX1; // b = y - mx
		var underRadical = Math.pow(r, 2) * Math.pow(m, 2) + Math.pow(r, 2) - Math.pow(b, 2);
		
		return !(underRadical < 0);
	};
	function collidingWith(subject, other) {
		var sLineInd;
		var oLineInd;
		
		// There are algorithms that can do faster polygonal collsion detection.
		// Maybe replace this with one of those later.
		if (distance(subject.x, subject.y, other.x, other.y) < subject.collRadius + other.collRadius) {
			for (sLineInd = 0; sLineInd < subject.collLines.length; sLineInd += 2) {
				for (oLineInd = 0; oLineInd < other.collLines.length; oLineInd += 2) {
					if (lineCheck(
						subject.collLines[sLineInd] + subject.x,
						subject.collLines[sLineInd + 1] + subject.y,
						subject.collLines[(sLineInd + 2) % subject.collLines.length] + subject.x,
						subject.collLines[(sLineInd + 3) % subject.collLines.length] + subject.y,
						other.collLines[oLineInd] + other.x,
						other.collLines[oLineInd + 1] + other.y,
						other.collLines[(oLineInd + 2) % other.collLines.length] + other.x,
						other.collLines[(oLineInd + 3) % other.collLines.length] + other.y
						)) {
							return other;
					}
				}
			}
		}
		
		return null;
	};
	function circleCollidingWith(subject, other) {
		var lineInd;
		
		if (distance(subject.x, subject.y, other.x, other.y) < subject.collRadius + other.collRadius) {
			for (lineInd = 0; lineInd < other.collLines.length; lineInd += 2) {
				if (circleToLineCheck(
					other.collLines[lineInd] + other.x,
					other.collLines[lineInd + 1] + other.y,
					other.collLines[(lineInd + 2) % other.collLines.length] + other.x,
					other.collLines[(lineInd + 3) % other.collLines.length] + other.y,
					subject.x,
					subject.y,
					subject.collRadius
				)) {
					return other;
				}
			}
		}
		
		return null;
	};
	function checkCollision(subject) {
		var entIndex;
		var other;
		var ret;
		
		// start at 9 because the boss occupies 0-7 and player occupies 8
		for (entIndex = 9; entIndex < entities.length; entIndex++) {
			other = entities[entIndex];
			if (!other.active || other == subject) {
				continue;
			}
			ret = collidingWith(subject, other);
			if (ret) {
				return ret;
			}
		}
		
		return null;
	};
    function getRandomIndex(arr) {
        return arr[Math.round(Math.random() * (arr.length - 1))];
    };
	function moveSelf(delta) {
		var oldAngle;
		var velSign;
		var other;
		var angleToOther;
		
		oldAngle = this.angle;
		this.angle += this.angleDelta * delta;
		this.updateCollLines();
		// angular collision
		if (checkCollision(this)) {
			this.angle = oldAngle;
			this.updateCollLines();
		}
		if (this.throttle) {
			this.xVelDelta = this.accel * Math.cos(this.angle + Math.PI / 2);
			this.yVelDelta = this.accel * Math.sin(-(this.angle + Math.PI / 2));
		} else {
			// slow to a stop
			if (Math.abs(this.xVel) > this.accel) {
				this.velSign = this.xVel >= 0 ? -1 : 1;
				this.xVelDelta = this.velSign * (this.accel / 3);
			} else {
				this.xVelDelta = 0;
				this.xVel = 0;
			}
			if (Math.abs(this.yVel) > this.accel) {
				this.velSign = this.yVel >= 0 ? -1 : 1;
				this.yVelDelta = this.velSign * (this.accel / 3);
			} else {
				this.yVelDelta = 0;
				this.yVel = 0;
			}
		}
		// Velocity is in units of pixels per millisecond.
		this.xVel += this.xVelDelta * delta;
		this.yVel += this.yVelDelta * delta;
		if (this.xVel > this.maxVel) {
			this.xVel = this.maxVel;
		}
		if (this.yVel > this.maxVel) {
			this.yVel = this.maxVel;
		}
		if (this.xVel < -this.maxVel) {
			this.xVel = -this.maxVel;
		}
		if (this.yVel < -this.maxVel) {
			this.yVel = -this.maxVel;
		}
		this.x += this.xVel * delta;
		this.y += this.yVel * delta;
		other = checkCollision(this);
		if (other) {
			this.xVel = -this.xVel;
			this.yVel = -this.yVel;
			if (other) { // something bumped me
				if ((this.xVel > 0 && this.xVel < other.xVel) ||
					(this.xVel < 0 && -1 * this.xVel < other.xVel) ||
					(this.xVel < 0 && this.xVel > other.xVel) ||
					(this.xVel > 0 && -1 * this.xVel > other.xVel) ||
					this.xVel == 0) {
					this.xVel = other.xVel * 2;
				}
				if ((this.yVel > 0 && this.yVel < other.yVel) ||
					(this.yVel < 0 && -1 * this.yVel < other.yVel) ||
					(this.yVel < 0 && this.yVel > other.yVel) ||
					(this.yVel > 0 && -1 * this.yVel > other.yVel) ||
					this.yVel == 0) {
					this.yVel = other.yVel * 2;
				}				
			}
			// bounce away cleanly
			do {
				angleToOther = getAngleTo(other, this);
				this.x += Math.abs(this.xVel) * Math.cos(angleToOther + Math.PI / 2) * delta;
				this.y -= Math.abs(this.yVel) * Math.sin(angleToOther + Math.PI / 2) * delta;
			} while (collidingWith(this, other));
			
			return other;
		}
		
		return null;
	};
	function wrapAngle(angle) {
		if (angle > 2 * Math.PI) {
			return angle - 2 * Math.PI;
		}
		if (angle < 0) {
			return angle + 2 * Math.PI;
		}
		
		return angle;
	};
	function getAngleTo(self, other) {
		var angleTo = Math.atan2(-(other.y - self.y), other.x - self.x) - Math.PI / 2;
		
		angleTo = wrapAngle(angleTo);
		
		return angleTo;
	};
	function kill(ent) {
		displaceAngle = Math.random() * 2 * Math.PI;
		ent.x += Math.cos(displaceAngle) * MAX_DISTANCE;
		ent.y += Math.sin(-displaceAngle) * MAX_DISTANCE;
	};
	function fieldWrap(ent) {
		if (ent.x - playerRef.x > MAX_DISTANCE) {
			ent.x = playerRef.x - MAX_DISTANCE + 2;
		} else if (ent.x - playerRef.x < -MAX_DISTANCE) {
			ent.x = playerRef.x + MAX_DISTANCE - 2;
		}
		if (ent.y - playerRef.y > MAX_DISTANCE) {
			ent.y = playerRef.y - MAX_DISTANCE + 2;
		} else if (ent.y - playerRef.y < -MAX_DISTANCE) {
			ent.y = playerRef.y + MAX_DISTANCE - 2;
		}
	};
	function updateTriangle(vectors, angle, radius) {
		vectors[0] = Math.cos(Math.PI / 2 + angle) * radius;
		vectors[1] = Math.sin(-Math.PI / 2 - angle) * radius;
		vectors[2] = (Math.cos(Math.PI * (4 / 3) + angle) * radius);
		vectors[3] = (Math.sin(-Math.PI * (4 / 3) - angle) * radius);
		vectors[4] = (Math.cos(Math.PI * (5 / 3) + angle) * radius);
		vectors[5] = (Math.sin(-Math.PI * (5 / 3) - angle) * radius);
	};
	function drawCircle(x, y, r, fill) {
		CTX.beginPath();
		CTX.arc(CANVAS.width / 2 + x,
			CANVAS.height / 2 + HUD_HEIGHT / 2 + y,
			r, 0, 2 * Math.PI);
		CTX.fillStyle = fill;
		CTX.fill();
	};
    // Objects
    function Player() {};
    Player.prototype = {
        x: 0,
        y: 0,
		imgWidth: 0,
		imgHeight: 0,
		blipColor: "#FFFFFF",
        angle: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
		accel: .0004,
        angleDelta: 0,
        maxVel: .3,
        throttle: false,
        collRadius: 15,
		collLines: [],
		active: true,
		shooting: false,
		lastShotTime: 0,
		coolDown: 250,
        updateCollLines: function () {
			updateTriangle(this.collLines, this.angle, this.collRadius);
        },
        updateState: function(delta) {
			moveSelf.call(this, delta);
			// make the screen track the player
			screenBoundX = Math.abs((this.xVel / this.maxVel)) * MAX_SCREEN_BOUND_X;
			screenBoundY = Math.abs((this.yVel / this.maxVel)) * MAX_SCREEN_BOUND_Y;
			if (this.x - screenX > screenBoundX) {
				screenX = this.x - screenBoundX;
			}
			else if (this.x - screenX < -screenBoundX) {
				screenX = this.x + screenBoundX;
			}
			if (this.y - screenY > screenBoundY) {
				screenY = this.y - screenBoundY;
			}
			else if (this.y - screenY < -screenBoundY) {
				screenY = this.y + screenBoundY;
			}
			// shoot
			if (this.shooting && performance.now() - this.lastShotTime >= this.coolDown) {
				playerBullets[playerBulletInd].activate(this.x, this.y, this.angle + Math.PI / 2);
				playerBulletInd = (playerBulletInd + 1) % playerBulletCount;
				this.lastShotTime = performance.now();
			}
        },
        draw: function() {
            var xCenter = CANVAS.width / 2 + (this.x - screenX);
            var yCenter = CANVAS.height / 2 + (this.y - screenY) + (HUD_HEIGHT / 2);
            var index;
            
            CTX.beginPath();
            CTX.moveTo(xCenter + this.collLines[0],
                yCenter + this.collLines[1]);
            for (index = 2; index < this.collLines.length; index += 2) {
                CTX.lineTo(xCenter + this.collLines[index],
                    yCenter + this.collLines[index + 1]);
            }
            CTX.fillStyle = "#00FF00";
            CTX.fill();
        }
    };
    function Asteroid(x, y) {
        var pointInd;
        var angle;
        var vertexCount = 10;
        var angleInc = (2 * Math.PI) / vertexCount;
        var minRadius = 10;
        var maxRadius = 50;
		var maxAppliedRadius = maxRadius;
        var radius;
        
        this.x = x;
        this.y = y;
		this.xVel = -.1 + Math.random() * .2;
		this.yVel = -.1 + Math.random() * .2;
		this.collLines = [];
        // Generate polygon points
        for (pointInd = 0; pointInd < vertexCount; pointInd++) {
            angle = pointInd * angleInc + Math.random() * (angleInc - .01);
            radius = minRadius + Math.random() * (maxRadius - minRadius);
			if (radius < maxAppliedRadius) {
				radius = maxAppliedRadius;
				maxAppliedRadius -= 10;
			}
            if (radius > this.collRadius) {
                this.collRadius = radius;
            }
            this.collLines.push(Math.round(Math.cos(angle) * radius));
            this.collLines.push(Math.round(Math.sin(angle) * radius));
        }
    };
    Asteroid.prototype = {
        constructor: Asteroid,
        x: 0,
        y: 0,
        collRadius: 0,
		blipColor: "#777777",
        collLines: [],
		active: true,
		heat: 0,
		maxHeat: 5,
		minCooldown: 1500,
		lastCrystalTime: 0,
        updateState: function (delta) {
			if (this.heat > 0) {
				this.heat -= .002 * delta;
				if (this.heat < 0) {
					this.heat = 0;
				} else if (this.heat > 0) {
					if (performance.now() - this.lastCrystalTime > this.minCooldown * (this.maxHeat / this.heat)) {
						crystals[crystalInd].activate(this.x, this.y, Math.random() * 2 * Math.PI);
						crystalInd = (crystalInd + 1) % crystalCount;
						this.lastCrystalTime = performance.now();
					}
				}
			}
			this.x += this.xVel * delta;
			this.y += this.yVel * delta;
			fieldWrap(this);
        },
		heatUp: function (amount) {
			var displaceAngle;
			
			if (this.heat == 0) {
				this.lastCrystalTime = performance.now();
			}
			this.heat += amount;
			if (this.heat > this.maxHeat) {
				this.heat = 0;
				kill(this);
			}
		},
        draw: function () {
            var index;
			var rChannel;
			var gbChannel;
            
            CTX.beginPath();
            CTX.moveTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
                CANVAS.height / 2 + (this.y + HUD_HEIGHT / 2 - screenY) + this.collLines[1]);
            for (index = 2; index < this.collLines.length - 1; index += 2) {
                CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[index],
                    CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[index + 1]);
            }
            CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
                    CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[1]);
			if (this.heat == 0) {
				CTX.fillStyle = "#AAAAAA";
			} else {
				rChannel = parseInt(170 + this.heat / this.maxHeat * 85);
				gbChannel = parseInt(170 - this.heat / this.maxHeat * 170);
				CTX.fillStyle = "rgba(" + rChannel + "," + gbChannel + "," + gbChannel + ", 1)";
			}
            CTX.fill();
        }
    };
	function Miner(x, y) {
		this.x = x;
		this.y = y;
		this.target = playerRef;
		this.collLines = new Array(6);
		this.target = getRandomIndex(asteroids);
	};
    Miner.prototype = {
        x: 0,
        y: 0,
		imgWidth: 0,
		imgHeight: 0,
		blipColor: "#FF0000",
        angle: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
		accel: .0015,
        angleDelta: 0,
        maxVel: .21,
        throttle: true,
        collRadius: 13,
		collLines: [],
        target: null,
		angleToTarget: 0,
		turnSpeed: .007,
		active: true,
		bumpCooldown: 500,
		lastBump: 0,
		hasCrystal: false,
        updateCollLines: function () {
			updateTriangle(this.collLines, this.angle, this.collRadius);
        },
		updateState: function (delta) {
			var angleToTarget = 0;
			var minTargetDist = this.target instanceof Asteroid ? 200 : 5;
			
            // update target
			if (this.hasCrystal && this.target != bossRef && !bossRef.isComplete()) {
				this.target = bossRef;
			} else if (!this.target.active || distance(this.x, this.y, this.target.x, this.target.y) < minTargetDist) {
				this.target = getRandomIndex(asteroids);
			}
			if (this.target == bossRef && bossRef.isComplete()) {
				this.target = getRandomIndex(asteroids);
			}
			// movement
			this.angle = wrapAngle(this.angle);
			angleToTarget = getAngleTo(this, this.target);
			// find the shortest arc and turn towards the target
			if (Math.abs(this.angle - angleToTarget) > Math.PI) {
				if (this.angle > angleToTarget) {
					this.angle += this.turnSpeed * delta;
				} else {
					this.angle -= this.turnSpeed * delta;
				}
			} else {
				if (this.angle > angleToTarget) {
					this.angle -= this.turnSpeed * delta;
				} else {
					this.angle += this.turnSpeed * delta;
				}
			}
			// wait for a clear path after hitting asteroid
			if (!this.throttle && performance.now() - this.lastBump >= this.bumpCooldown) {
				this.throttle = true;
			}
			if (moveSelf.call(this, delta) instanceof Asteroid) {
				this.lastBump = performance.now();
				this.throttle = false;
			}
		},
		kill: function () {
			if (this.hasCrystal) {
				crystals[crystalInd].activate(this.x, this.y, Math.random() * 2 * Math.PI);
				crystalInd = (crystalInd + 1) % crystalCount;
			}
			this.hasCrystal = false;
			this.target = getRandomIndex(asteroids);
			kill(this);
		},
		draw: function () {
			var index;
			
			CTX.beginPath();
			CTX.moveTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
				CANVAS.height / 2 + (this.y + HUD_HEIGHT / 2 - screenY) + this.collLines[1]);
			for (index = 2; index < this.collLines.length; index += 2) {
				CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[index],
					CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[index + 1]);
			}
			CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
					CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[1]);
			CTX.fillStyle = "#FF0000";
			CTX.fill();
			if (this.hasCrystal) {
				drawCircle(this.x - screenX, this.y - screenY, Crystal.prototype.collRadius, "#5555FF");
			}
		}
	};
	function Shooter(x, y) {
		this.health = this.maxHealth;
		this.x = x;
		this.y = y;
	};
    Shooter.prototype = {
        x: 0,
        y: 0,
		imgWidth: 0,
		imgHeight: 0,
		blipColor: "#FF00FF",
        angle: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
		accel: .0007,
        angleDelta: 0,
        maxVel: .2,
        throttle: false,
        collRadius: SHOOTER_RADIUS,
		collLines: [SHOOTER_RADIUS,
					0,
					Math.cos(Math.PI / 3) * SHOOTER_RADIUS,
					Math.sin(-Math.PI / 3) * SHOOTER_RADIUS,
					Math.cos(Math.PI * (2 / 3)) * SHOOTER_RADIUS,
					Math.sin(-Math.PI * (2 / 3)) * SHOOTER_RADIUS,
					Math.cos(Math.PI) * SHOOTER_RADIUS,
					Math.sin(-Math.PI) * SHOOTER_RADIUS,
					Math.cos(Math.PI * (4 / 3)) * SHOOTER_RADIUS,
					Math.sin(-Math.PI * (4 / 3)) * SHOOTER_RADIUS,
					Math.cos(Math.PI * (5 / 3)) * SHOOTER_RADIUS,
					Math.sin(-Math.PI * (5 / 3)) * SHOOTER_RADIUS],
        target: null,
		angleToTarget: 0,
		turnSpeed: .002,
		lastShotTime: 0,
		coolDown: 1000,
		maxHealth: 3,
		health: 0,
		active: true,
        updateCollLines: function () {
			// doesn't rotate
        },
		updateState: function (delta) {
			var angleToTarget = 0;
			
			if (this.health < 1) {
				kill(this);
				this.target = null;
				this.health = this.maxHealth;
			}
			// movement
			if (this.target != null) {
				this.angle = wrapAngle(this.angle);
				angleToTarget = getAngleTo(this, this.target);
				// find the shortest arc and turn towards the target
				if (Math.abs(this.angle - angleToTarget) > Math.PI) {
					if (this.angle > angleToTarget) {
						this.angle += this.turnSpeed * delta;
					} else {
						this.angle -= this.turnSpeed * delta;
					}
				} else {
					if (this.angle > angleToTarget) {
						this.angle -= this.turnSpeed * delta;
					} else {
						this.angle += this.turnSpeed * delta;
					}
				}
				this.throttle = !(distance(this.x, this.y, this.target.x, this.target.y) < 200);
				moveSelf.call(this, delta);
				// shoot
				if (distance(this.x, this.y, this.target.x, this.target.y) < 250 &&
						performance.now() - this.lastShotTime >= this.coolDown) {
					enemyBullets[enemyBulletInd].activate(this.x, this.y, angleToTarget + Math.PI / 2);
					enemyBulletInd = (enemyBulletInd + 1) % enemyBulletCount;
					this.lastShotTime = performance.now();
				}
			} else {
				if (distance(this.x, this.y, playerRef.x, playerRef.y) < 800) {
					this.target = playerRef;
				}
			}
			fieldWrap(this);
		},
		draw: function () {
			var index;
			
			CTX.beginPath();
			CTX.moveTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
				CANVAS.height / 2 + (this.y + HUD_HEIGHT / 2 - screenY) + this.collLines[1]);
			for (index = 2; index < this.collLines.length; index += 2) {
				CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[index],
					CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[index + 1]);
			}
			CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
					CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[1]);
			CTX.fillStyle = "#AA00AA";
			CTX.fill();
		}
	};
	function EnemyBullet() {
	};
	EnemyBullet.prototype = {
        x: 0,
        y: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
        collRadius: 3,
		blipColor: null,
		collLines: [],
		muzzleVel: .7,
		birthTime: 0,
		lifeSpan: 1000,
		active: false,
		activate: function (x, y, dir) {
			this.birthTime = performance.now();
			this.x = x;
			this.y = y;
			this.xVel = Math.cos(dir) * this.muzzleVel;
			this.yVel = Math.sin(-dir) * this.muzzleVel;
			this.active = true;
		},
		updateState: function (delta) {
			var now = performance.now();
			var entInd;
			
			if (now - this.birthTime > this.lifeSpan) {
				this.active = false;
				return;
			}
			this.x += this.xVel * delta;
			this.y += this.yVel * delta;
			for (entInd = 0; entInd < asteroids.length; entInd++) {
				if (circleCollidingWith(this, asteroids[entInd])) {
					asteroids[entInd].heatUp(3);
					this.active = false;
					return;
				}
			}
			if (circleCollidingWith(this, playerRef)) {
				this.active = false;
			}
		},
		draw: function () {
			drawCircle(this.x - screenX, this.y - screenY, this.collRadius, "#FFFF00");
		}
	};
	function PlayerBullet() {
	};
	PlayerBullet.prototype = {
        x: 0,
        y: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
        collRadius: 3,
		blipColor: null,
		collLines: [],
		muzzleVel: .7,
		birthTime: 0,
		lifeSpan: 1000,
		active: false,
		activate: function (x, y, dir) {
			this.birthTime = performance.now();
			this.x = x;
			this.y = y;
			this.xVel = Math.cos(dir) * this.muzzleVel;
			this.yVel = Math.sin(-dir) * this.muzzleVel;
			this.active = true;
		},
		updateState: function (delta) {
			var now = performance.now();
			var entInd;
			
			if (now - this.birthTime > this.lifeSpan) {
				this.active = false;
				return;
			}
			this.x += this.xVel * delta;
			this.y += this.yVel * delta;
			for (entInd = 0; entInd < asteroids.length; entInd++) {
				if (circleCollidingWith(this, asteroids[entInd])) {
					asteroids[entInd].heatUp(1);
					this.active = false;
					return;
				}
			}
			for (entInd = 0; entInd < miners.length; entInd++) {
				if (circleCollidingWith(this, miners[entInd])) {
					miners[entInd].kill();
					this.active = false;
					return;
				}
			}
			for (entInd = 0; entInd < shooters.length; entInd++) {
				if (circleCollidingWith(this, shooters[entInd])) {
					shooters[entInd].health -= 1;
					this.active = false;
					return;
				}
			}
		},
		draw: function () {
			drawCircle(this.x - screenX, this.y - screenY, this.collRadius, "#CCCCCC");
		}
	};
    function Crystal() {
    };
    Crystal.prototype = {
        x: 0,
        y: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
        collRadius: 3,
		blipColor: "#BBBBFF",
		collLines: [],
		maxVel: .07,
		birthTime: 0,
		lifeSpan: 10000,
		active: false,
		activate: function (x, y, dir) {
			var minerInd;
			var miner;
			
			this.birthTime = performance.now();
			this.x = x;
			this.y = y;
			this.xVel = Math.cos(dir) * this.maxVel;
			this.yVel = Math.sin(-dir) * this.maxVel;
			for (minerInd = 0; minerInd < minerCount; minerInd++) {
				miner = miners[minerInd];
				if (miners[minerInd].active && !(miners[minerInd].target instanceof Crystal) && !miners[minerInd].hasCrystal) {
					miners[minerInd].target = this;
					break;
				}
			}
			this.active = true;
		},
		updateState: function (delta) {
			var now = performance.now();
			var minerInd;
			var other;
			
			if (now - this.birthTime > this.lifeSpan) {
				this.active = false;
				return;
			}
			this.x += this.xVel * delta;
			this.y += this.yVel * delta;
			for (minerInd = 0; minerInd < minerCount; minerInd++) {
				other = circleCollidingWith(this, miners[minerInd]);
				if (other && other.active && !other.hasCrystal) {
					other.hasCrystal = true;
					this.active = false;
					break;
				}
			}
		},
		draw: function () {
			drawCircle(this.x - screenX, this.y - screenY, this.collRadius, "#5555FF");
		}
    };
	function Boss() {
	};
	Boss.prototype = {
        x: 100,
        y: 100,
		imgWidth: 0,
		imgHeight: 0,
		blipColor: "#FFFF00",
        angle: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
		accel: .0007,
        angleDelta: 0,
        maxVel: .3,
        throttle: false,
        collRadius: BOSS_RADIUS,
		collLines: [],
        target: null,
		angleToTarget: 0,
		turnSpeed: .002,
		activePieces: 0,
		active: true,
		updateState: function (delta) {
			var minerInd;
			var miner;
			
			this.x = bossRef.x;
			this.y = bossRef.y;
			if (!this.isComplete()) {
				for (minerInd = 0; minerInd < minerCount; minerInd++) {
					miner = miners[minerInd];
					if (distance(this.x, this.y, miner.x, miner.y) < 30 && miner.hasCrystal) {
						this.activePieces++;
						bossPieces[this.activePieces - 1].active = true;
						miner.hasCrystal = false;
						miner.kill();
					}
				}
			}
		},
		isComplete: function () {
			return (this.activePieces == 8);
		},
		draw: function () {
			var index;
			
			CTX.beginPath();
			CTX.moveTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
				CANVAS.height / 2 + (this.y + HUD_HEIGHT / 2 - screenY) + this.collLines[1]);
			for (index = 0; index < this.collLines.length; index += 2) {
				CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[index],
					CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[index + 1]);
			}
			CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
					CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[1]);
			CTX.fillStyle = "#660000";
			CTX.fill();			
		}
	};
	function bossPiece(x, y, pieceNumber) {
		this.x = x;
		this.y = y;
		switch (pieceNumber) {
			case 0:
				this.collLines = [0,
					0,
					BOSS_RADIUS,
					0,
					Math.cos(Math.PI / 4) * BOSS_RADIUS,
					Math.sin(-Math.PI / 4) * BOSS_RADIUS];
				break;
			case 1:
				this.collLines = [0,
					0,
					Math.cos(Math.PI / 4) * BOSS_RADIUS,
					Math.sin(-Math.PI / 4) * BOSS_RADIUS,
					Math.cos(Math.PI / 2) * BOSS_RADIUS,
					Math.sin(-Math.PI / 2) * BOSS_RADIUS];
					break;
			case 2:
				this.collLines = [0,
					0,
					Math.cos(Math.PI / 2) * BOSS_RADIUS,
					Math.sin(-Math.PI / 2) * BOSS_RADIUS,
					Math.cos(Math.PI * (3 / 4)) * BOSS_RADIUS,
					Math.sin(-Math.PI * (3 / 4)) * BOSS_RADIUS];
				break;
			case 3:
				this.collLines = [0,
					0,
					Math.cos(Math.PI * (3 / 4)) * BOSS_RADIUS,
					Math.sin(-Math.PI * (3 / 4)) * BOSS_RADIUS,
					Math.cos(Math.PI) * BOSS_RADIUS,
					Math.sin(-Math.PI) * BOSS_RADIUS];
				break;
			case 4:
				this.collLines = [0,
					0,
					Math.cos(Math.PI) * BOSS_RADIUS,
					Math.sin(-Math.PI) * BOSS_RADIUS,
					Math.cos(Math.PI * (5 / 4)) * BOSS_RADIUS,
					Math.sin(-Math.PI * (5 / 4)) * BOSS_RADIUS];
				break;
			case 5:
				this.collLines = [0,
					0,
					Math.cos(Math.PI * (5 / 4)) * BOSS_RADIUS,
					Math.sin(-Math.PI * (5 / 4)) * BOSS_RADIUS,
					Math.cos(Math.PI * (3 / 2)) * BOSS_RADIUS,
					Math.sin(-Math.PI * (3 / 2)) * BOSS_RADIUS];
				break;
			case 6:
				this.collLines = [0,
					0,
					Math.cos(Math.PI * (3 / 2)) * BOSS_RADIUS,
					Math.sin(-Math.PI * (3 / 2)) * BOSS_RADIUS,
					Math.cos(Math.PI * (7 / 4)) * BOSS_RADIUS,
					Math.sin(-Math.PI * (7 / 4)) * BOSS_RADIUS];
				break;
			case 7:
				this.collLines = [0,
					0,
					Math.cos(Math.PI * (7 / 4)) * BOSS_RADIUS,
					Math.sin(-Math.PI * (7 / 4)) * BOSS_RADIUS,
					BOSS_RADIUS,
					0];
				break;
			default:
				break;
		}
	};
	bossPiece.prototype = {
        x: 0,
        y: 0,
		imgWidth: 0,
		imgHeight: 0,
		blipColor: null,
        angle: 0,
        xVel: 0,
        yVel: 0,
        xVelDelta: 0,
        yVelDelta: 0,
		accel: 0,
        angleDelta: 0,
        maxVel: 0,
        throttle: false,
		active: false,
        collRadius: BOSS_RADIUS,
		collLines: [],
		updateState: function () {
		},
		draw: function () {
			var index;
			
			CTX.beginPath();
			CTX.moveTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
				CANVAS.height / 2 + (this.y + HUD_HEIGHT / 2 - screenY) + this.collLines[1]);
			for (index = 0; index < this.collLines.length; index += 2) {
				CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[index],
					CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[index + 1]);
			}
			CTX.lineTo(CANVAS.width / 2 + (this.x - screenX) + this.collLines[0],
					CANVAS.height / 2 + HUD_HEIGHT / 2 + (this.y - screenY) + this.collLines[1]);
			CTX.fillStyle = "#444444";
			CTX.fill();
		}
	};
    
    // Setup
	entities.push(new Boss());
	bossRef = entities[0];
	for (index = 0; index < 8; index++) {
		entities.push(new bossPiece(100, 100, index));
		bossPieces[bossPieces.length] = entities[entities.length - 1];
	}
    playerRef = new Player();
    entities.push(playerRef);
	screenX = playerRef.x;
	screenY = playerRef.y;
	CTX.lineWidth = 1;
	// Scatter some asteroids around the player
    asteroids = new Array(50);
	for (index = 0; index < 50; index++) {
		entities.push(new Asteroid(
			(Math.random() >= .5 ? 1 : -1) * Math.random() * (MAX_DISTANCE - 100) + 200,
			(Math.random() >= .5 ? 1 : -1) * Math.random() * (MAX_DISTANCE - 100) + 200));
		entRef = entities[index + 10];
		// move out of the way if on top of the player
		if (distance(entRef.x, entRef.y, playerRef.x, playerRef.y) < 100) {
			entRef.x += entRef.collRadius;
		}
        // register each asteroid
        asteroids[index] = entRef;
        asteroidCount++;
	}
    miners = new Array();
	entities.push(new Miner(300, 300));
	miners.push(entities[entities.length - 1]);
    minerCount++;
	entities.push(new Miner(320, 320));
	miners.push(entities[entities.length - 1]);
    minerCount++;
	entities.push(new Miner(340, 340));
	miners.push(entities[entities.length - 1]);
    minerCount++;
	entities.push(new Miner(360, 360));
	miners.push(entities[entities.length - 1]);
    minerCount++;
	entities.push(new Miner(380, 380));
	miners.push(entities[entities.length - 1]);
    minerCount++;
	enemyBullets = new Array();
	for (index = 0; index < 20; index++) {
		entities.push(new EnemyBullet());
		enemyBullets[index] = entities[entities.length - 1];
		enemyBulletCount++;
	}
	shooters = new Array();
	entities.push(new Shooter(450, 450));
	shooters.push(entities[entities.length - 1]);
	shooterCount++;
	crystals = new Array();
	for (index = 0; index < 30; index++) {
		entities.push(new Crystal());
		crystals[index] = entities[entities.length - 1];
		crystalCount++;
	}
	playerBullets = new Array();
	for (index = 0; index < 20; index++) {
		entities.push(new PlayerBullet());
		playerBullets[index] = entities[entities.length - 1];
		playerBulletCount++;
	}
    document.onkeydown = keyDownHandler;
    document.onkeyup = keyUpHandler;
    requestAnimationFrame(mainLoop); // Begin loop
}());