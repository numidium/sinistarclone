(function () {
    var CANVAS = document.getElementById('gameCanvas');
    var CTX = CANVAS.getContext('2d');
	var HUD_HEIGHT = 80;
	var MINIMAP_SCALE = 30;
	var MAX_DISTANCE = 1500;
	var MAX_TIME_DELTA = 1000; // less than 1 fps is not worth interpolating
    var MINER_RADIUS = 14;
    var SHOOTER_RADIUS = 17;
	var BOSS_RADIUS = 100;
	var MAX_SCREEN_BOUND_X = 100;
	var MAX_SCREEN_BOUND_Y = 50;
	var screenBoundX;
	var screenBoundY;
	var screenX;
	var screenY;
	function startGame() {
		// Setup
        var TIMESTEP = 10; // How finely the state is interpolated between frames. Higher = choppier.
        var lastFrameTimestamp = 0;
        var timeDelta = 0;
        var mmLeft = CANVAS.width / 2 - HUD_HEIGHT / 2;
        var index;
        var entRef;
        var entLookup = {
            entities: [],
            playerRef: null,
            bossRef: null,
            miners: [],
            asteroids: [],
            crystals: [],
            crystalInd: 0,
            shooters: [],
            bossPieces: [],
            playerBullets: [],
            playerBulletInd: 0,
            enemyBullets: [],
            enemyBulletInd: 0
        };
        function keyDownHandler(e) {
            switch(e.keyCode) {
                case 38: // up
                    entLookup.playerRef.throttle = true;
                    break;
                case 37: // left
                    entLookup.playerRef.angleDelta = .005;
                    break;
                case 39: // right
                    entLookup.playerRef.angleDelta = -.005;
                    break;
                case 32: // space
                    entLookup.playerRef.shooting = true;
                default:
                    break;
            }
        };
        function keyUpHandler(e) {
            switch(e.keyCode) {
                case 38: // up
                    entLookup.playerRef.throttle = false;
                    break;
                case 37: // left
                case 39: // right
                    entLookup.playerRef.angleDelta = 0;
                    break;
                case 32: // space
                    entLookup.playerRef.shooting = false;
                    break;
                default:
                    break;
            }
        };

        document.onkeydown = keyDownHandler;
		document.onkeyup = keyUpHandler;
        entLookup.bossRef = new Boss();
        entLookup.entities.push(entLookup.bossRef);
        for (index = 0; index < 8; index++) {
            entLookup.entities.push(new bossPiece(0, 0, index));
            entLookup.bossPieces[entLookup.bossPieces.length] = entLookup.entities[entLookup.entities.length - 1];
        }
        entLookup.playerRef = new Player();
        entLookup.entities.push(entLookup.playerRef);
        screenX = entLookup.playerRef.x;
        screenY = entLookup.playerRef.y;
        CTX.lineWidth = 1;
        entLookup.asteroids = new Array(50);
        for (index = 0; index < 50; index++) {
            entLookup.entities.push(new Asteroid(
				(Math.random() >= .5 ? 1 : -1) * Math.random() * (MAX_DISTANCE - 100) + 200,
				(Math.random() >= .5 ? 1 : -1) * Math.random() * (MAX_DISTANCE - 100) + 200));
            entRef = entLookup.entities[index + 10];
			// move out of the way if on top of the player
			if (distance(entRef.x, entRef.y, entLookup.playerRef.x, entLookup.playerRef.y) < 100) {
				entRef.x += entRef.collRadius;
			}
			// register each asteroid
			entLookup.asteroids[index] = entRef;
        }
        entLookup.miners = new Array();
        for (index = 0; index < 10; index++) {
            entLookup.entities.push(new Miner());
            entLookup.entities[entLookup.entities.length - 1].activate(
                (Math.random() >= .5 ? 1 : -1) * Math.random() * (MAX_DISTANCE - 300) + 200,
				(Math.random() >= .5 ? 1 : -1) * Math.random() * (MAX_DISTANCE - 300) + 200,
                entLookup);
            entLookup.miners.push(entLookup.entities[entLookup.entities.length - 1]);
		}
		entLookup.enemyBullets = new Array();
		for (index = 0; index < 20; index++) {
			entLookup.entities.push(new EnemyBullet());
			entLookup.enemyBullets[index] = entLookup.entities[entLookup.entities.length - 1];
		}
		entLookup.shooters = new Array();
		entLookup.entities.push(new Shooter());
		entLookup.entities[entLookup.entities.length - 1].activate(450, 450);
		entLookup.shooters.push(entLookup.entities[entLookup.entities.length - 1]);
		entLookup.crystals = new Array();
		for (index = 0; index < 30; index++) {
			entLookup.entities.push(new Crystal());
			entLookup.crystals[index] = entLookup.entities[entLookup.entities.length - 1];
		}
		entLookup.playerBullets = new Array();
		for (index = 0; index < 20; index++) {
			entLookup.entities.push(new PlayerBullet());
			entLookup.playerBullets[index] = entLookup.entities[entLookup.entities.length - 1];
		}
		requestAnimationFrame(mainLoop); // Begin loop
		function mainLoop(timeStamp) {
			var entIndex;
			var curEnt;
			var mmX; // minimap x, y
			var mmY;
            var plrRef = entLookup.playerRef;
			
			timeDelta += timeStamp - lastFrameTimestamp;
			timeDelta = timeDelta > MAX_TIME_DELTA ? MAX_TIME_DELTA : timeDelta;
			lastFrameTimestamp = timeStamp;
			// Interpolate state updates
			while (timeDelta >= TIMESTEP) {
				for (entIndex = 0; entIndex < entLookup.entities.length; entIndex++) {
					if (entLookup.entities[entIndex].active) {
						entLookup.entities[entIndex].updateState(TIMESTEP, entLookup);
					}
				}
				timeDelta -= TIMESTEP;
			}
			// Drawing
			CTX.clearRect(0, 0, CANVAS.width, CANVAS.height); // clear the canvas
			// Draw entities
			for (entIndex = 0; entIndex < entLookup.entities.length; entIndex++) {
				curEnt = entLookup.entities[entIndex];
				if (curEnt.active) {
					entLookup.entities[entIndex].draw();
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
			CTX.rect(mmLeft + HUD_HEIGHT / 2 - (plrRef.x - screenX + CANVAS.width / 2) / MINIMAP_SCALE,
				HUD_HEIGHT / 2 - (plrRef.y - screenY + (CANVAS.height - HUD_HEIGHT) / 2) / MINIMAP_SCALE,
				CANVAS.width / MINIMAP_SCALE,
				(CANVAS.height - HUD_HEIGHT) / MINIMAP_SCALE);
			CTX.stroke();
			// Draw minimap blips
			for (entIndex = 0; entIndex < entLookup.entities.length; entIndex++) {
				curEnt = entLookup.entities[entIndex];
				if (!curEnt.active || !curEnt.blipColor) {
					continue;
				}
				mmX = mmLeft + HUD_HEIGHT / 2 - 1 + (curEnt.x - plrRef.x) / MINIMAP_SCALE;
				if (mmX - 1 < mmLeft || mmX + 1 >= mmLeft + HUD_HEIGHT) {
					continue;
				}
				mmY = HUD_HEIGHT / 2 - 1 + (curEnt.y - plrRef.y) / MINIMAP_SCALE;
				if (mmY < 0 || mmY + 1 >= HUD_HEIGHT) {
					continue;
				}
				CTX.fillStyle = curEnt.blipColor;
				CTX.fillRect(mmX, mmY, 2, 2);
			}
			requestAnimationFrame(mainLoop);
		};
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
	function checkCollision(subject, elu) {
		var entIndex;
		var other;
		var ret;
		
		if (subject.collLines.length > 0) {
			// start at 9 because the boss occupies 0-7 and player occupies 8
			for (entIndex = 9; entIndex < elu.entities.length; entIndex++) {
				other = elu.entities[entIndex];
				if (!other.active || other == subject) {
					continue;
				}
				ret = collidingWith(subject, other);
				if (ret) {
					return ret;
				}
			}
		}
		
		return null;
	};
    function getRandomIndex(arr) {
        return arr[Math.round(Math.random() * (arr.length - 1))];
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
		var displaceAngle = Math.random() * 2 * Math.PI;
		ent.x += Math.cos(displaceAngle) * MAX_DISTANCE;
		ent.y += Math.sin(-displaceAngle) * MAX_DISTANCE;
	};
	function fieldWrap(ent, playerRef) {
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
    function drawPolygon(x, y, collLines, fill) {
        var index;

        CTX.beginPath();
        CTX.moveTo(CANVAS.width / 2 + (x - screenX) + collLines[0],
            CANVAS.height / 2 + (y + HUD_HEIGHT / 2 - screenY) + collLines[1]);
        for (index = 2; index < collLines.length - 1; index += 2) {
            CTX.lineTo(CANVAS.width / 2 + (x - screenX) + collLines[index],
                CANVAS.height / 2 + HUD_HEIGHT / 2 + (y - screenY) + collLines[index + 1]);
        }
        CTX.lineTo(CANVAS.width / 2 + (x - screenX) + collLines[0],
                CANVAS.height / 2 + HUD_HEIGHT / 2 + (y - screenY) + collLines[1]);
        CTX.fillStyle = fill;
        CTX.fill();
    };
    // Objects
	function Entity() {};
	Entity.prototype = {
		x: 0,
		y: 0,
		angle: 0,
		xVel: 0,
		yVel: 0,
		xVelDelta: 0,
		yVelDelta: 0,
		throttle: false,
		angleDelta: 0,
		collLines: [],
		active: false,
        moveSelf: function (delta, elu) {
            var oldAngle;
            var velSign;
            var other;
            var angleToOther;
            
            oldAngle = this.angle;
            this.angle += this.angleDelta * delta;
            this.updateCollLines();
            // angular collision
            if (checkCollision(this, elu)) {
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
			other = checkCollision(this, elu);
			if (other) {
				this.xVel = -this.xVel;
				this.yVel = -this.yVel;
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
				// bounce away cleanly
				do {
					angleToOther = getAngleTo(other, this);
					this.x += Math.abs(this.xVel) * Math.cos(angleToOther + Math.PI / 2) * delta;
					this.y -= Math.abs(this.yVel) * Math.sin(angleToOther + Math.PI / 2) * delta;
				} while (collidingWith(this, other));
				
				return other;
			}
            
            return null;
        },
		updateCollLines: function () {}
	};
    function Player() {};
    Player.prototype = Object.create(Entity.prototype);
	Player.prototype.blipColor = "#FFFFFF";
	Player.prototype.accel = .0004;
	Player.prototype.angleDelta = 0;
	Player.prototype.maxVel = .3;
	Player.prototype.throttle = false;
	Player.prototype.collRadius = 15;
	Player.prototype.collLines = [];
	Player.prototype.active = true;
	Player.prototype.shooting = false;
	Player.prototype.lastShotTime = 0;
	Player.prototype.coolDown = 250;
	Player.prototype.updateCollLines = function () {
		updateTriangle(this.collLines, this.angle, this.collRadius);
	};
	Player.prototype.updateState = function (delta, elu) {
		this.moveSelf(delta, elu);
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
			elu.playerBullets[elu.playerBulletInd].activate(this.x, this.y, this.angle + Math.PI / 2);
			elu.playerBulletInd = (elu.playerBulletInd + 1) % elu.playerBullets.length;
			this.lastShotTime = performance.now();
		}
	};
	Player.prototype.draw = function() {
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
		this.active = true;
    };
    Asteroid.prototype = Object.create(Entity.prototype);
	Asteroid.prototype.collRadius = 0;
	Asteroid.prototype.blipColor = "#777777";
	Asteroid.prototype.heat = 0;
	Asteroid.prototype.maxHeat = 5;
	Asteroid.prototype.minCooldown = 1500;
	Asteroid.prototype.lastCrystalTime = 0;
	Asteroid.prototype.updateState = function (delta, elu) {
		if (this.heat > 0) {
			this.heat -= .002 * delta;
			if (this.heat < 0) {
				this.heat = 0;
			} else if (this.heat > 0) {
				if (performance.now() - this.lastCrystalTime > this.minCooldown * (this.maxHeat / this.heat)) {
					elu.crystals[elu.crystalInd].activate(this.x, this.y, Math.random() * 2 * Math.PI, elu);
					elu.crystalInd = (elu.crystalInd + 1) % elu.crystals.length;
					this.lastCrystalTime = performance.now();
				}
			}
		}
		this.x += this.xVel * delta;
		this.y += this.yVel * delta;
		fieldWrap(this, elu.playerRef);
	};
	Asteroid.prototype.heatUp = function (amount) {
		var displaceAngle;
		
		if (this.heat == 0) {
			this.lastCrystalTime = performance.now();
		}
		this.heat += amount;
		if (this.heat > this.maxHeat) {
			this.heat = 0;
			kill(this);
		}
	};
	Asteroid.prototype.draw = function () {
		var rChannel;
		var gbChannel;
        var fill;
		
		if (this.heat == 0) {
			fill = "#AAAAAA";
		} else {
			rChannel = parseInt(170 + this.heat / this.maxHeat * 85);
			gbChannel = parseInt(170 - this.heat / this.maxHeat * 170);
			fill = "rgba(" + rChannel + "," + gbChannel + "," + gbChannel + ", 1)";
		}
        drawPolygon(this.x, this.y, this.collLines, fill);
    };
	function Miner() {
		this.collLines = new Array(6);
		this.active = true;
	};
    Miner.prototype = Object.create(Entity.prototype);
	Miner.prototype.blipColor = "#FF0000";
	Miner.prototype.accel = .0015;
	Miner.prototype.maxVel = .21;
	Miner.prototype.collRadius = MINER_RADIUS;
	Miner.prototype.target = null;
	Miner.prototype.angleToTarget = 0;
	Miner.prototype.turnSpeed = .007;
	Miner.prototype.bumpCooldown = 500;
	Miner.prototype.lastBump = 0;
	Miner.prototype.hasCrystal = false;
	Miner.prototype.updateCollLines = function () {
		updateTriangle(this.collLines, this.angle, this.collRadius);
	};
	Miner.prototype.updateState = function (delta, elu) {
		var angleToTarget = 0;
		var minTargetDist = this.target instanceof Asteroid ? 200 : 5;
		
		// update target
		if (this.hasCrystal && this.target != elu.bossRef && !elu.bossRef.isComplete()) {
			this.target = elu.bossRef;
		} else if (!this.target.active || distance(this.x, this.y, this.target.x, this.target.y) < minTargetDist) {
			this.target = getRandomIndex(elu.asteroids);
		}
		if (this.target == elu.bossRef && elu.bossRef.isComplete()) {
			this.target = getRandomIndex(elu.asteroids);
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
		if (this.moveSelf(delta, elu) instanceof Asteroid) {
			this.lastBump = performance.now();
			this.throttle = false;
		}
	};
	Miner.prototype.activate = function (x, y, elu) {
		this.x = x;
		this.y = y;
		this.target = getRandomIndex(elu.asteroids);
		this.active = true;
	};
	Miner.prototype.kill = function (elu) {
		if (this.hasCrystal) {
			elu.crystals[elu.crystalInd].activate(this.x, this.y, Math.random() * 2 * Math.PI);
			elu.crystalInd = (elu.crystalInd + 1) % elu.crystals.length;
		}
		this.hasCrystal = false;
		this.target = getRandomIndex(elu.asteroids);
		kill(this);
	};
	Miner.prototype.draw = function () {
        drawPolygon(this.x, this.y, this.collLines, "#FF0000");
		if (this.hasCrystal) {
			drawCircle(this.x - screenX, this.y - screenY, Crystal.prototype.collRadius, "#5555FF");
		}
	};
	function Shooter() {
	};
    Shooter.prototype = Object.create(Entity.prototype);
	Shooter.prototype.blipColor = "#FF00FF";
	Shooter.prototype.accel = .0007;
	Shooter.prototype.maxVel = .2;
	Shooter.prototype.collRadius = SHOOTER_RADIUS;
	Shooter.prototype.collLines = [Shooter.prototype.collRadius,
				0,
				Math.cos(Math.PI / 3) * Shooter.prototype.collRadius,
				Math.sin(-Math.PI / 3) * Shooter.prototype.collRadius,
				Math.cos(Math.PI * (2 / 3)) * Shooter.prototype.collRadius,
				Math.sin(-Math.PI * (2 / 3)) * Shooter.prototype.collRadius,
				Math.cos(Math.PI) * Shooter.prototype.collRadius,
				Math.sin(-Math.PI) * Shooter.prototype.collRadius,
				Math.cos(Math.PI * (4 / 3)) * Shooter.prototype.collRadius,
				Math.sin(-Math.PI * (4 / 3)) * Shooter.prototype.collRadius,
				Math.cos(Math.PI * (5 / 3)) * Shooter.prototype.collRadius,
				Math.sin(-Math.PI * (5 / 3)) * Shooter.prototype.collRadius],
	Shooter.prototype.target = null;
	Shooter.prototype.angleToTarget = 0;
	Shooter.prototype.turnSpeed = .002;
	Shooter.prototype.lastShotTime = 0;
	Shooter.prototype.coolDown = 1000;
	Shooter.prototype.maxHealth = 3;
	Shooter.prototype.health = 0;
	Shooter.prototype.updateCollLines = function () {
		// doesn't rotate
	};
	Shooter.prototype.updateState = function (delta, elu) {
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
			this.moveSelf(delta, elu);
			// shoot
			if (distance(this.x, this.y, this.target.x, this.target.y) < 250 &&
					performance.now() - this.lastShotTime >= this.coolDown) {
				elu.enemyBullets[elu.enemyBulletInd].activate(this.x, this.y, angleToTarget + Math.PI / 2);
				elu.enemyBulletInd = (elu.enemyBulletInd + 1) % elu.enemyBullets.length;
				this.lastShotTime = performance.now();
			}
		} else {
			if (distance(this.x, this.y, elu.playerRef.x, elu.playerRef.y) < 800) {
				this.target = elu.playerRef;
			}
		}
		fieldWrap(this, elu.playerRef);
	};
	Shooter.prototype.activate = function (x, y) {
		this.x = x;
		this.y = y;
		this.active = true;
		this.health = this.maxHealth;
	};
	Shooter.prototype.draw = function () {
        drawPolygon(this.x, this.y, this.collLines, "#AA00AA");
	};
	function EnemyBullet() {
	};
	EnemyBullet.prototype = Object.create(Entity.prototype);
	EnemyBullet.prototype.collRadius = 3;
	EnemyBullet.prototype.blipColor = null;
	EnemyBullet.prototype.muzzleVel = .6;
	EnemyBullet.prototype.birthTime = 0;
	EnemyBullet.prototype.lifeSpan = 1000;
	EnemyBullet.prototype.activate = function (x, y, dir) {
		this.birthTime = performance.now();
		this.x = x;
		this.y = y;
		this.xVel = Math.cos(dir) * this.muzzleVel;
		this.yVel = Math.sin(-dir) * this.muzzleVel;
		this.active = true;
	};
	EnemyBullet.prototype.updateState = function (delta, elu) {
		var now = performance.now();
		var entInd;
		
		if (now - this.birthTime > this.lifeSpan) {
			this.active = false;
			return;
		}
		this.x += this.xVel * delta;
		this.y += this.yVel * delta;
		for (entInd = 0; entInd < elu.asteroids.length; entInd++) {
			if (circleCollidingWith(this, elu.asteroids[entInd])) {
				elu.asteroids[entInd].heatUp(3);
				this.active = false;
				return;
			}
		}
		if (circleCollidingWith(this, elu.playerRef)) {
			this.active = false;
		}
	};
	EnemyBullet.prototype.draw = function () {
		drawCircle(this.x - screenX, this.y - screenY, this.collRadius, "#FFFF00");
	}
	function PlayerBullet() {
	};
	PlayerBullet.prototype = Object.create(Entity.prototype);
	PlayerBullet.prototype.collRadius = 3;
	PlayerBullet.prototype.blipColor = null;
	PlayerBullet.prototype.muzzleVel = .7;
	PlayerBullet.prototype.birthTime = 0;
	PlayerBullet.prototype.lifeSpan = 1000;
	PlayerBullet.prototype.activate = function (x, y, dir) {
		this.birthTime = performance.now();
		this.x = x;
		this.y = y;
		this.xVel = Math.cos(dir) * this.muzzleVel;
		this.yVel = Math.sin(-dir) * this.muzzleVel;
		this.active = true;
	};
	PlayerBullet.prototype.updateState = function (delta, elu) {
		var now = performance.now();
		var entInd;
		
		if (now - this.birthTime > this.lifeSpan) {
			this.active = false;
			return;
		}
		this.x += this.xVel * delta;
		this.y += this.yVel * delta;
		for (entInd = 0; entInd < elu.asteroids.length; entInd++) {
			if (circleCollidingWith(this, elu.asteroids[entInd])) {
				elu.asteroids[entInd].heatUp(1);
				this.active = false;
				return;
			}
		}
		for (entInd = 0; entInd < elu.miners.length; entInd++) {
			if (circleCollidingWith(this, elu.miners[entInd])) {
				elu.miners[entInd].kill(elu);
				this.active = false;
				return;
			}
		}
		for (entInd = 0; entInd < elu.shooters.length; entInd++) {
			if (circleCollidingWith(this, elu.shooters[entInd])) {
				elu.shooters[entInd].health -= 1;
				this.active = false;
				return;
			}
		}
	};
	PlayerBullet.prototype.draw = function () {
		drawCircle(this.x - screenX, this.y - screenY, this.collRadius, "#CCCCCC");
	};
    function Crystal() {
    };
    Crystal.prototype = Object.create(Entity.prototype);
	Crystal.prototype.collRadius = 3;
	Crystal.prototype.blipColor = "#BBBBFF";
	Crystal.prototype.maxVel = .07;
	Crystal.prototype.birthTime = 0;
	Crystal.prototype.lifeSpan = 10000;
	Crystal.prototype.activate = function (x, y, dir, elu) {
		var minerInd;
		var miner;
		
		this.birthTime = performance.now();
		this.x = x;
		this.y = y;
		this.xVel = Math.cos(dir) * this.maxVel;
		this.yVel = Math.sin(-dir) * this.maxVel;
		for (minerInd = 0; minerInd < elu.miners.length; minerInd++) {
			miner = elu.miners[minerInd];
			if (elu.miners[minerInd].active && !(elu.miners[minerInd].target instanceof Crystal) && !elu.miners[minerInd].hasCrystal) {
				elu.miners[minerInd].target = this;
				break;
			}
		}
		this.active = true;
	};
	Crystal.prototype.updateState = function (delta, elu) {
		var now = performance.now();
		var minerInd;
		var other;
		
		if (now - this.birthTime > this.lifeSpan) {
			this.active = false;
			return;
		}
		this.x += this.xVel * delta;
		this.y += this.yVel * delta;
		for (minerInd = 0; minerInd < elu.miners.length; minerInd++) {
			other = circleCollidingWith(this, elu.miners[minerInd]);
			if (other && other.active && !other.hasCrystal) {
				other.hasCrystal = true;
				this.active = false;
				break;
			}
		}
	};
	Crystal.prototype.draw = function () {
		drawCircle(this.x - screenX, this.y - screenY, this.collRadius, "#5555FF");
	};
	function Boss() {
		this.active = true;
	};
	Boss.prototype = Object.create(Entity.prototype);
	Boss.prototype.blipColor = "#FFFF00";
	Boss.prototype.accel = .0007;
	Boss.prototype.angleDelta = 0;
	Boss.prototype.maxVel = .3;
	Boss.prototype.collRadius = BOSS_RADIUS;
	Boss.prototype.target = null;
	Boss.prototype.angleToTarget = 0;
	Boss.prototype.turnSpeed = .002;
	Boss.prototype.activePieces = 0;
	Boss.prototype.updateState = function (delta, elu) {
		var minerInd;
		var miner;
		
		this.x = elu.bossRef.x;
		this.y = elu.bossRef.y;
		if (!this.isComplete()) {
			for (minerInd = 0; minerInd < elu.miners.length; minerInd++) {
				miner = elu.miners[minerInd];
				if (distance(this.x, this.y, miner.x, miner.y) < 25 && miner.hasCrystal) {
					this.activePieces++;
					elu.bossPieces[this.activePieces - 1].active = true;
					miner.hasCrystal = false;
					miner.kill(elu);
				}
			}
		}
		fieldWrap(this, elu.playerRef);
	};
	Boss.prototype.isComplete = function () {
		return (this.activePieces == 8);
	};
	Boss.prototype.draw = function () {
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
	};
	function bossPiece(x, y, pieceNumber) {
		this.x = x;
		this.y = y;
		switch (pieceNumber) {
			case 0:
				this.collLines = [0,
					0,
					Boss.prototype.collRadius,
					0,
					Math.cos(Math.PI / 4) * Boss.prototype.collRadius,
					Math.sin(-Math.PI / 4) * Boss.prototype.collRadius];
				break;
			case 1:
				this.collLines = [0,
					0,
					Math.cos(Math.PI / 4) * Boss.prototype.collRadius,
					Math.sin(-Math.PI / 4) * Boss.prototype.collRadius,
					Math.cos(Math.PI / 2) * Boss.prototype.collRadius,
					Math.sin(-Math.PI / 2) * Boss.prototype.collRadius];
					break;
			case 2:
				this.collLines = [0,
					0,
					Math.cos(Math.PI / 2) * Boss.prototype.collRadius,
					Math.sin(-Math.PI / 2) * Boss.prototype.collRadius,
					Math.cos(Math.PI * (3 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (3 / 4)) * Boss.prototype.collRadius];
				break;
			case 3:
				this.collLines = [0,
					0,
					Math.cos(Math.PI * (3 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (3 / 4)) * Boss.prototype.collRadius,
					Math.cos(Math.PI) * Boss.prototype.collRadius,
					Math.sin(-Math.PI) * Boss.prototype.collRadius];
				break;
			case 4:
				this.collLines = [0,
					0,
					Math.cos(Math.PI) * Boss.prototype.collRadius,
					Math.sin(-Math.PI) * Boss.prototype.collRadius,
					Math.cos(Math.PI * (5 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (5 / 4)) * Boss.prototype.collRadius];
				break;
			case 5:
				this.collLines = [0,
					0,
					Math.cos(Math.PI * (5 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (5 / 4)) * Boss.prototype.collRadius,
					Math.cos(Math.PI * (3 / 2)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (3 / 2)) * Boss.prototype.collRadius];
				break;
			case 6:
				this.collLines = [0,
					0,
					Math.cos(Math.PI * (3 / 2)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (3 / 2)) * Boss.prototype.collRadius,
					Math.cos(Math.PI * (7 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (7 / 4)) * Boss.prototype.collRadius];
				break;
			case 7:
				this.collLines = [0,
					0,
					Math.cos(Math.PI * (7 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (7 / 4)) * Boss.prototype.collRadius,
					Boss.prototype.collRadius,
					0];
				break;
			default:
				break;
		}
	};
	bossPiece.prototype = Object.create(Entity.prototype);
	bossPiece.prototype.blipColor = null;
	bossPiece.prototype.accel = 0;
	bossPiece.prototype.maxVel = 0;
	bossPiece.prototype.collRadius = BOSS_RADIUS;
	bossPiece.prototype.updateState = function (delta, elu) {
		this.x = elu.bossRef.x;
		this.y = elu.bossRef.y;
	};
	bossPiece.prototype.draw = function () {
        drawPolygon(this.x, this.y, this.collLines, "#444444");
	};
	startGame();
}());