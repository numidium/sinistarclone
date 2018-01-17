(function () {
	"use strict";
    var CANVAS = document.getElementById('gameCanvas');
    var CTX = CANVAS.getContext('2d');
    var screenBoundX;
    var screenBoundY;
    var screenX;
    var screenY;
    var statusText = "";
    var lastStatus = 0;
    var statusTimeout = 4000;
    var statusColor = "#00FFFF";
    var score = 0;
	const HUD_HEIGHT = 80;
	const MINIMAP_SCALE = 30;
	const MAX_DISTANCE = 1500;
	const MAX_TIME_DELTA = 1000; // less than 1 fps is not worth interpolating
    const MINER_RADIUS = 14;
    const SHOOTER_RADIUS = 17;
	const BOSS_RADIUS = 100;
	const MAX_SCREEN_BOUND_X = 100;
	const MAX_SCREEN_BOUND_Y = 50;
	const UP_KEY = 38;
	const LEFT_KEY = 37;
	const RIGHT_KEY = 39;
	function startGame() {
		// Setup
        const TIMESTEP = 10; // How finely the state is interpolated between frames. Higher = choppier.
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
            enemyBulletInd: 0,
			bombs: [],
			bombInd: 0
        };
		var lifeSymbolLines = new Array(6);
        function keyDownHandler(e) {
            switch(e.keyCode) {
                case UP_KEY: // up
                    entLookup.playerRef.throttle = true;
                    break;
                case LEFT_KEY: // left
                    entLookup.playerRef.turningLeft = true;
					entLookup.playerRef.lastTurnKey = e.keyCode;
                    break;
                case RIGHT_KEY: // right
                    entLookup.playerRef.turningRight = true;
					entLookup.playerRef.lastTurnKey = e.keyCode;
                    break;
                case 32: // space
                    entLookup.playerRef.shooting = true;
					break;
				case 90: // Z
					entLookup.playerRef.pendingBomb = true;
					break;
                default:
                    break;
            }
        };
        function keyUpHandler(e) {
            switch(e.keyCode) {
                case UP_KEY: // up
                    entLookup.playerRef.throttle = false;
                    break;
                case LEFT_KEY: // left
					entLookup.playerRef.turningLeft = false;
					break;
                case RIGHT_KEY: // right
                    entLookup.playerRef.turningRight = false;
                    break;
                case 32: // space
                    entLookup.playerRef.shooting = false;
                    break;
                default:
                    break;
            }
        };
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
			CTX.fillStyle = "#404040";
			CTX.fillRect(0, 0, CANVAS.width, HUD_HEIGHT);
			CTX.fillStyle = "#000040";
			CTX.fillRect(mmLeft, 0, 80, 80);
		    // visible distance rectangle
			CTX.beginPath();
			CTX.strokeStyle = "#FFFF00";
			CTX.rect(mmLeft + HUD_HEIGHT / 2 - (plrRef.x - screenX + CANVAS.width / 2) / MINIMAP_SCALE,
				HUD_HEIGHT / 2 - (plrRef.y - screenY + (CANVAS.height - HUD_HEIGHT) / 2) / MINIMAP_SCALE,
				CANVAS.width / MINIMAP_SCALE,
				(CANVAS.height - HUD_HEIGHT) / MINIMAP_SCALE);
			CTX.stroke();
		    // status outline
			CTX.beginPath();
			CTX.strokeStyle = statusColor;
			CTX.rect(0, 0, CANVAS.width, HUD_HEIGHT);
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
			// Draw bomb count
			for (entIndex = 0; entIndex < entLookup.playerRef.bombs; entIndex++) {
				drawCircle(20 + entIndex * 10 - (CANVAS.width / 2), -(CANVAS.height / 2 - 20), Crystal.prototype.collRadius, "#5555FF");
			}
			// Draw lives
			for (entIndex = 0; entIndex < entLookup.playerRef.lives; entIndex++) {
				CTX.beginPath();
				CTX.moveTo(30 + (entIndex * 35) + lifeSymbolLines[0], 25 + lifeSymbolLines[1]);
				for (index = 2; index < lifeSymbolLines.length - 1; index += 2) {
					CTX.lineTo(30 + (entIndex * 35) + lifeSymbolLines[index], 25 + lifeSymbolLines[index + 1]);
				}
				CTX.lineTo(20 + (entIndex * 10) + lifeSymbolLines[0], 25 + lifeSymbolLines[1]);
				CTX.fillStyle = "#00FF00";
				CTX.fill();
			}
		    // Draw status text
			if (statusText) {
			    CTX.fillStyle = "#FFFF00";
			    CTX.textAlign = "center";
			    CTX.font = "30px Impact";
			    CTX.fillText(statusText, CANVAS.width / 2, CANVAS.height / 2);
			    if (performance.now() - lastStatus > statusTimeout) {
			        statusText = "";
			    }
			}
		    // Draw score
			CTX.fillStyle = "#FFFFFF";
			CTX.textAlign = "left";
			CTX.font = "10px Courier New";
			CTX.fillText(score.toString().padStart(7, "0"), 17, 75);
			requestAnimationFrame(mainLoop);
		};
		
		Player.prototype.updateShape(lifeSymbolLines, 0);
        document.onkeydown = keyDownHandler;
		document.onkeyup = keyUpHandler;
        entLookup.bossRef = new Boss();
        entLookup.entities.push(entLookup.bossRef);
        for (index = 0; index < 9; index++) {
            entLookup.entities.push(new BossPiece(index));
            entLookup.bossPieces[entLookup.bossPieces.length] = entLookup.entities[entLookup.entities.length - 1];
        }
		entLookup.bombs = new Array();
		for (index = 0; index < 15; index++) {
			entLookup.entities.push(new Bomb());
			entLookup.bombs[index] = entLookup.entities[entLookup.entities.length - 1];
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
            entRef = entLookup.entities[entLookup.entities.length - 1];
			// move out of the way if on top of the player
			if (distance(entRef.x, entRef.y, entLookup.playerRef.x, entLookup.playerRef.y) < 100) {
				entRef.x += entRef.collRadius;
			}
			// register each asteroid
			entLookup.asteroids[index] = entRef;
        }
        entLookup.miners = new Array();
        for (index = 0; index < 15; index++) {
            entLookup.entities.push(new Miner());
            entLookup.miners.push(entLookup.entities[entLookup.entities.length - 1]);
		}
		entLookup.enemyBullets = new Array();
		for (index = 0; index < 20; index++) {
			entLookup.entities.push(new EnemyBullet());
			entLookup.enemyBullets[index] = entLookup.entities[entLookup.entities.length - 1];
		}
		entLookup.shooters = new Array();
		for (index = 0; index < 15; index++) {
			entLookup.entities.push(new Shooter());
			entLookup.shooters.push(entLookup.entities[entLookup.entities.length - 1]);
		}
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
		score = 0;
		entLookup.bossRef.activate(entLookup);
		requestAnimationFrame(mainLoop); // Begin loop
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
			for (entIndex = 2 + elu.bossPieces.length + elu.bombs.length;
					entIndex < elu.entities.length; entIndex++) {
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
	function translateToOrigin(ent) {
		if (ent.x > 0) {
			ent.x = -(MAX_DISTANCE) + (ent.x % (MAX_DISTANCE * 2));
		} else {
			ent.x = MAX_DISTANCE + (ent.x % (MAX_DISTANCE * 2));
		}
		if (ent.y > 0) {
			ent.y = -(MAX_DISTANCE) + (ent.y % (MAX_DISTANCE * 2));
		} else {
			ent.y = (MAX_DISTANCE) + (ent.y % (MAX_DISTANCE * 2));
		}
	};
	function placeAwayFrom(x, y, ent) {
		var theta = Math.random() * (2 * Math.PI);
		
		ent.x = x + Math.cos(theta) * MAX_DISTANCE;
		ent.y = y + Math.sin(-theta) * MAX_DISTANCE;
	};
	function updateTriangle(vectors, angle, radius) {
		vectors[0] = Math.cos(Math.PI / 2 + angle) * radius;
		vectors[1] = Math.sin(-Math.PI / 2 - angle) * radius;
		vectors[2] = Math.cos(Math.PI * (4 / 3) + angle) * radius;
		vectors[3] = Math.sin(-Math.PI * (4 / 3) - angle) * radius;
		vectors[4] = Math.cos(Math.PI * (5 / 3) + angle) * radius;
		vectors[5] = Math.sin(-Math.PI * (5 / 3) - angle) * radius;
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
	function getNearestActive(self, entList) {
		var entInd;
		var ent = entList[0];
		
		for (entInd = 0; entInd < entList.length; entInd++) {
			if (entList[entInd].active &&
				distance(self.x, self.y, entList[entInd].x, entList[entInd].y) < 
					distance(self.x, self.y, ent.x, ent.y)) {
				ent = entList[entInd];
			}
		}
		
		return ent;
	};
	function trackScreenToEntity(self, maxSpeed) {
		screenBoundX = Math.abs(self.xVel / maxSpeed) * MAX_SCREEN_BOUND_X;
		screenBoundY = Math.abs(self.yVel / maxSpeed) * MAX_SCREEN_BOUND_Y;
		if (self.x - screenX > screenBoundX) {
			screenX = self.x - screenBoundX;
		} else if (self.x - screenX < -screenBoundX) {
			screenX = self.x + screenBoundX;
		}
		if (self.y - screenY > screenBoundY) {
			screenY = self.y - screenBoundY;
		} else if (self.y - screenY < -screenBoundY) {
			screenY = self.y + screenBoundY;
		}
	};
	function assignMinerToCrystal(elu, crysRef) {
	    var miner;
	    var minerInd;
	    var startInd = 0;

	    miner = elu.miners[0];
	    while (elu.miners[startInd++].hasCrystal && startInd < elu.miners.length) {
	        miner = elu.miners[startInd];
	    }
	    for (minerInd = 1; minerInd < elu.miners.length; minerInd++) {
	        if (elu.miners[minerInd].active &&
				!(elu.miners[minerInd].target instanceof Crystal) &&
				!elu.miners[minerInd].hasCrystal &&
				distance(crysRef.x, crysRef.y, elu.miners[minerInd].x, elu.miners[minerInd].y) <
					distance(crysRef.x, crysRef.y, miner.x, miner.y)) {
	            miner = elu.miners[minerInd];
	        }
	    }
	    miner.target = crysRef;
	};
	function updateStatus(text) {
	    statusText = text;
	    lastStatus = performance.now();
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
		collisionOn: true,
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
            if (this.collisionOn && checkCollision(this, elu)) {
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
			other = (!this.collisionOn ? null : checkCollision(this, elu));
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
		updateCollLines: function () {},
		turnToTarget: function (delta) {
			var angleToTarget;
			
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
		}
	};
    function Player() {};
    Player.prototype = Object.create(Entity.prototype);
	Player.prototype.blipColor = "#FFFFFF";
	Player.prototype.accel = .0004;
	Player.prototype.angleDelta = 0;
	Player.prototype.maxVel = .3;
	Player.prototype.turnSpeed = .005;
	Player.prototype.throttle = false;
	Player.prototype.turningLeft = false;
	Player.prototype.turningRight = false;
	Player.prototype.lastTurnKey = 0;
	Player.prototype.pendingBomb = false;
	Player.prototype.collRadius = 15;
	Player.prototype.collLines = [];
	Player.prototype.active = true;
	Player.prototype.shooting = false;
	Player.prototype.lastShotTime = 0;
	Player.prototype.coolDown = 250;
	Player.prototype.lastDeath = 0;
	Player.prototype.respawnDelay = 4000;
	Player.prototype.lives = 2;
	Player.prototype.bombs = 0;
	Player.prototype.MAX_BOMBS = 15;
	Player.prototype.MAX_LIVES = 10;
	Player.prototype.warpDelay = 3000;
	Player.prototype.level = 0;
	Player.prototype.updateCollLines = function () {
	    this.updateShape(this.collLines, this.angle);
	};
	Player.prototype.updateState = function (delta, elu) {
		if (!elu.bossRef.active) {
			this.xVel = this.maxVel * 3;
			this.yVel = this.maxVel * 3;
			this.warp(delta, elu);
		} else {
			if (this.turningLeft && this.turningRight) {
				if (this.lastTurnKey == LEFT_KEY) {
					this.angleDelta = this.turnSpeed;
				} else if (this.lastTurnKey == RIGHT_KEY) {
					this.angleDelta = -this.turnSpeed;
				}
			} else if (this.turningLeft) {
				this.angleDelta = this.turnSpeed;
			} else if (this.turningRight) {
				this.angleDelta = -this.turnSpeed;
			} else {
				this.angleDelta = 0;
			}
			this.moveSelf(delta, elu);
			trackScreenToEntity(this, this.maxVel);
		}
		// shoot
		if (this.shooting && performance.now() - this.lastShotTime >= this.coolDown) {
			elu.playerBullets[elu.playerBulletInd].activate(this.x, this.y, this.angle + Math.PI / 2);
			elu.playerBulletInd = (elu.playerBulletInd + 1) % elu.playerBullets.length;
			this.lastShotTime = performance.now();
		}
		if (this.pendingBomb && !elu.bossRef.caught) {
			elu.playerRef.shootBomb(elu);
		}
	};
	Player.prototype.activate = function (elu) {
		var entInd;
		
		this.lives--;
		this.x = 0;
		this.y = 0;
		this.angle = 0;
		this.xVel = 0;
		this.yVel = 0;
		for (entInd = 0; entInd < elu.asteroids.length; entInd++) {
			translateToOrigin(elu.asteroids[entInd]);
		}
		for (entInd = 0; entInd < elu.shooters.length; entInd++) {
			placeAwayFrom(this.x, this.y, elu.shooters[entInd]);
		}
		for (entInd = 0; entInd < elu.miners.length; entInd++) {
			placeAwayFrom(this.x, this.y, elu.miners[entInd]);
		}
		placeAwayFrom(this.x, this.y, elu.bossRef);
		for (entInd = 0; entInd < elu.shooters.length; entInd++) {
			elu.shooters[entInd].kill(elu);
		}
		elu.bossRef.lastShooterSpawn = performance.now();
		this.active = true;
	};
	Player.prototype.kill = function (elu) {
	    var bombInd;

		this.pendingBomb = false;
		this.active = false;
		this.lastDeath = performance.now();
		for (bombInd = 0; bombInd < elu.bombs.length; bombInd++) {
		    elu.bombs[bombInd].active = false;
		}
	};
	Player.prototype.addBomb = function () {
		if (this.bombs < this.MAX_BOMBS) {
			this.bombs++;
		}
	};
	Player.prototype.shootBomb = function (elu) {
		if (this.bombs > 0) {
			elu.bombs[elu.bombInd].activate(elu, this.x, this.y);
			elu.bombInd = (elu.bombInd + 1) % elu.bombs.length;
			this.bombs--;
		}
		this.pendingBomb = false;
	};
	Player.prototype.warp = function (delta, elu) {
		var timeSince = performance.now() - elu.bossRef.timeOfDeath;
		var entInd;
		const destAngle = (5 / 4) * Math.PI;
		
		this.angle = wrapAngle(this.angle);
		if (timeSince > this.warpDelay) {
			this.x += delta * this.xVel;
			this.y += delta * this.yVel;
			trackScreenToEntity(this, this.maxVel * 3);
		} else {
			if (Math.abs(this.angle - destAngle) > Math.PI) {
				if (this.angle > destAngle) {
					this.angle += this.turnSpeed * delta;
				} else {
					this.angle -= this.turnSpeed * delta;
				}
			} else {
				if (this.angle > destAngle) {
					this.angle -= this.turnSpeed * delta;
				} else {
					this.angle += this.turnSpeed * delta;
				}
			}
			if (Math.abs(this.angle - destAngle) <= this.turnSpeed + .05) {
			    this.angle = destAngle;
			}
		}
		this.updateCollLines();
		if (timeSince > this.warpDelay * 3) {
			this.level++;
			elu.bossRef.activate(elu);
		}
	};
	Player.prototype.updateShape = function (lines, angle) {
	    lines[0] = Math.cos(1.6373644905707205 + angle) * 15.033296378372908;
	    lines[1] = Math.sin(-1.6373644905707205 - angle) * 15.033296378372908;
	    lines[2] = Math.cos(1.7975951748487824 + angle) * 13.341664064126334;
	    lines[3] = Math.sin(-1.7975951748487824 - angle) * 13.341664064126334;
	    lines[4] = Math.cos(2.5535900500422257 + angle) * 3.605551275463989;
	    lines[5] = Math.sin(-2.5535900500422257 - angle) * 3.605551275463989;
	    lines[6] = Math.cos(-2.5535900500422257 + angle) * 18.027756377319946;
	    lines[7] = Math.sin(2.5535900500422257 - angle) * 18.027756377319946;
	    lines[8] = Math.cos(-2.390663591191853 + angle) * 20.518284528683193;
	    lines[9] = Math.sin(2.390663591191853 - angle) * 20.518284528683193;
	    lines[10] = Math.cos(-2.321725389192837 + angle) * 20.518284528683193;
	    lines[11] = Math.sin(2.321725389192837 - angle) * 20.518284528683193;
	    lines[12] = Math.cos(-2.2455372690184494 + angle) * 19.209372712298546;
	    lines[13] = Math.sin(2.2455372690184494 - angle) * 19.209372712298546;
	    lines[14] = Math.cos(-2.0344439357957027 + angle) * 8.94427190999916;
	    lines[15] = Math.sin(2.0344439357957027 - angle) * 8.94427190999916;
	    lines[16] = Math.cos(-1.1071487177940904 + angle) * 8.94427190999916;
	    lines[17] = Math.sin(1.1071487177940904 - angle) * 8.94427190999916;
	    lines[18] = Math.cos(-0.8960553845713439 + angle) * 19.209372712298546;
	    lines[19] = Math.sin(0.8960553845713439 - angle) * 19.209372712298546;
	    lines[20] = Math.cos(-0.8198672643969563 + angle) * 20.518284528683193;
	    lines[21] = Math.sin(0.8198672643969563 - angle) * 20.518284528683193;
	    lines[22] = Math.cos(-0.7509290623979403 + angle) * 20.518284528683193;
	    lines[23] = Math.sin(0.7509290623979403 - angle) * 20.518284528683193;
	    lines[24] = Math.cos(-0.5880026035475675 + angle) * 18.027756377319946;
	    lines[25] = Math.sin(0.5880026035475675 - angle) * 18.027756377319946;
	    lines[26] = Math.cos(0.5880026035475675 + angle) * 3.605551275463989;
	    lines[27] = Math.sin(-0.5880026035475675 - angle) * 3.605551275463989;
	    lines[28] = Math.cos(1.3439974787410107 + angle) * 13.341664064126334;
	    lines[29] = Math.sin(-1.3439974787410107 - angle) * 13.341664064126334;
	    lines[30] = Math.cos(1.5042281630190728 + angle) * 15.033296378372908;
	    lines[31] = Math.sin(-1.5042281630190728 - angle) * 15.033296378372908;
	};
	Player.prototype.draw = function () {
		drawPolygon(this.x, this.y, this.collLines, "#00FF00");
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
	Asteroid.prototype.heatUp = function (amount, elu) {
		var displaceAngle;
		
		if (this.heat == 0) {
			this.lastCrystalTime = performance.now();
		}
		this.heat += amount;
		if (this.heat > this.maxHeat) {
			this.heat = 0;
			this.kill(elu.playerRef);
		}
	};
	Asteroid.prototype.kill = function (pRef) {
		placeAwayFrom(pRef.x, pRef.y, this);
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
    // TODO: make miners stop circling around nothing (likely invisible asteroids)
	function Miner() {
		this.collLines = new Array(22);
		this.throttle = true;
	};
    Miner.prototype = Object.create(Entity.prototype);
	Miner.prototype.blipColor = "#FF0000";
	Miner.prototype.accel = .0015;
	Miner.prototype.maxVel = .21;
	Miner.prototype.collRadius = MINER_RADIUS;
	Miner.prototype.target = null;
	Miner.prototype.angleToTarget = 0;
	Miner.prototype.turnSpeed = .007;
	Miner.prototype.bumpCooldown = 200;
	Miner.prototype.lastBump = 0;
	Miner.prototype.hasCrystal = false;
	Miner.prototype.avoiding = false;
	Miner.prototype.turnSign = 1;
	Miner.prototype.nearTarget = false;
	Miner.prototype.lastStop = 0;
	Miner.prototype.stopLength = 700;
	Miner.prototype.nearDistance = 100;
	Miner.prototype.updateCollLines = function () {
	    this.collLines[0] = Math.cos(1.9513027039072615 + this.angle) * 5.385164807134504;
	    this.collLines[1] = Math.sin(-1.9513027039072615 - this.angle) * 5.385164807134504;
	    this.collLines[2] = Math.cos(1.7359450042095235 + this.angle) * 12.165525060596439;
	    this.collLines[3] = Math.sin(-1.7359450042095235 - this.angle) * 12.165525060596439;
	    this.collLines[4] = Math.cos(1.892546881191539 + this.angle) * 12.649110640673518;
	    this.collLines[5] = Math.sin(-1.892546881191539 - this.angle) * 12.649110640673518;
	    this.collLines[6] = Math.cos(2.0344439357957027 + this.angle) * 8.94427190999916;
	    this.collLines[7] = Math.sin(-2.0344439357957027 - this.angle) * 8.94427190999916;
	    this.collLines[8] = Math.cos(-2.5535900500422257 + this.angle) * 10.816653826391969;
	    this.collLines[9] = Math.sin(2.5535900500422257 - this.angle) * 10.816653826391969;
	    this.collLines[10] = Math.cos(-1.8157749899217608 + this.angle) * 12.36931687685298;
	    this.collLines[11] = Math.sin(1.8157749899217608 - this.angle) * 12.36931687685298;
	    this.collLines[12] = Math.cos(-1.3258176636680326 + this.angle) * 12.36931687685298;
	    this.collLines[13] = Math.sin(1.3258176636680326 - this.angle) * 12.36931687685298;
	    this.collLines[14] = Math.cos(-0.5880026035475675 + this.angle) * 10.816653826391969;
	    this.collLines[15] = Math.sin(0.5880026035475675 - this.angle) * 10.816653826391969;
	    this.collLines[16] = Math.cos(1.1071487177940904 + this.angle) * 8.94427190999916;
	    this.collLines[17] = Math.sin(-1.1071487177940904 - this.angle) * 8.94427190999916;
	    this.collLines[18] = Math.cos(1.2490457723982544 + this.angle) * 12.649110640673518;
	    this.collLines[19] = Math.sin(-1.2490457723982544 - this.angle) * 12.649110640673518;
	    this.collLines[20] = Math.cos(1.4056476493802699 + this.angle) * 12.165525060596439;
	    this.collLines[21] = Math.sin(-1.4056476493802699 - this.angle) * 12.165525060596439;
	    this.collLines[22] = Math.cos(1.1902899496825317 + this.angle) * 5.385164807134504;
	    this.collLines[23] = Math.sin(-1.1902899496825317 - this.angle) * 5.385164807134504;
	};
	Miner.prototype.updateState = function (delta, elu) {
		var angleToTarget = 0;
		var minTargetDist = this.target instanceof Asteroid ? 200 : 5;
		var distanceToTarget = distance(this.x, this.y, this.target.x, this.target.y);
		
		// update target
		if (this.hasCrystal && !elu.bossRef.alive && this.target != elu.bossRef) {
			this.target = elu.bossRef;
			this.nearTarget = false;
		} else if (!this.target.active || distanceToTarget < minTargetDist ||
					(this.target == elu.bossRef && elu.bossRef.alive)) {
			this.target = getRandomIndex(elu.asteroids);
		}
		// movement
		this.angle = wrapAngle(this.angle);
		angleToTarget = getAngleTo(this, this.target);
		if (performance.now() - this.lastBump <= this.bumpCooldown) {
			// turn to fly around asteroids
			if (!this.avoiding) {
				this.avoiding = true;
				this.turnSign *= -1;
			}
			this.angle += this.turnSign * this.turnSpeed * delta;
		} else {
			 if (Math.abs(this.angle - angleToTarget) > Math.PI) {
				// find the shortest arc and turn towards the target
				if (this.angle > angleToTarget) {
					this.angle += this.turnSpeed * delta;
				} else {
					this.angle -= this.turnSpeed * delta;
				}
				if (this.avoiding) {
					this.avoiding = false;
				}
			} else {
				if (this.angle > angleToTarget) {
					this.angle -= this.turnSpeed * delta;
				} else {
					this.angle += this.turnSpeed * delta;
				}
			}
			// no longer trying to avoid an obstacle
			if (this.avoiding) {
				this.avoiding = false;
			}
		}
		// stop before going towards a small target
		if ((this.target instanceof Crystal || this.target instanceof Boss) &&
			!this.nearTarget &&
			distance(this.x, this.y, this.target.x, this.target.y) < this.nearDistance) {
			this.nearTarget = true;
			this.lastStop = performance.now();
			this.throttle = false;
		} else if (performance.now() - this.lastStop >= this.stopLength) {
			this.throttle = true;
		}
		if (this.moveSelf(delta, elu) instanceof Asteroid) {
			this.lastBump = performance.now();
		}
		fieldWrap(this, elu.playerRef);
	};
	Miner.prototype.activate = function (x, y, elu) {
		this.x = x;
		this.y = y;
		this.target = getRandomIndex(elu.asteroids);
		this.active = true;
	};
	Miner.prototype.kill = function (elu) {
	    if (this.hasCrystal) {
	        this.active = false;
			elu.crystals[elu.crystalInd].activate(this.x, this.y, this.angle + Math.PI / 2, elu);
			elu.crystalInd = (elu.crystalInd + 1) % elu.crystals.length;
			this.active = true;
			this.hasCrystal = false;
	    } else if (this.target instanceof Crystal) {
	        assignMinerToCrystal(elu, this.target);
	    }
		this.target = getRandomIndex(elu.asteroids);
		this.throttle = true;
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
				Math.sin(-Math.PI * (5 / 3)) * Shooter.prototype.collRadius];
	Shooter.prototype.target = null;
	Shooter.prototype.angleToTarget = 0;
	Shooter.prototype.turnSpeed = .002;
	Shooter.prototype.lastShotTime = 0;
	Shooter.prototype.minThrottleDist = 200;
	Shooter.prototype.coolDown = 1000;
	Shooter.prototype.miningCooldown = 15000;
	Shooter.prototype.lockOnTime = 4000;
	Shooter.prototype.lockOnDist = 400;
	Shooter.prototype.foundPlayer = false;
	Shooter.prototype.foundTime = 0;
	Shooter.prototype.maxTargetDist = 500;
	Shooter.prototype.shooting = false;
	Shooter.prototype.updateCollLines = function () {
		// doesn't rotate
	};
	Shooter.prototype.updateState = function (delta, elu) {
		var dist;
		
		if (!elu.bossRef.caught) {
			// movement
			dist = distance(this.x, this.y, this.target.x, this.target.y);
			this.turnToTarget(delta);
			this.throttle = !(distance(this.x, this.y, this.target.x, this.target.y) < this.minThrottleDist);
			this.moveSelf(delta, elu);
			// shoot
			if (!this.shooting) { // wait before we start shooting the player
				if (!this.foundPlayer && distance(this.x, this.y, elu.playerRef.x, elu.playerRef.y) < this.lockOnDist) {
					this.foundPlayer = true;
					this.foundTime = performance.now();
					this.target = elu.playerRef;
				} else if (this.foundPlayer && performance.now() - this.foundTime > this.lockOnTime) {
					this.shooting = true;
				}
			}
			if (this.target instanceof Asteroid) { // mine asteroids if player is not around
				if (dist > this.maxTargetDist) {
					this.target = getNearestActive(this, elu.asteroids);
				}
				if (performance.now() - this.lastShotTime > this.miningCooldown &&
					dist < this.lockOnDist) {
					this.shoot(elu);
				}
			} else if (this.shooting && elu.playerRef.active &&
					performance.now() - this.lastShotTime > this.coolDown &&
					dist < this.lockOnDist) {
				this.shoot(elu);
			}
		}
		fieldWrap(this, elu.playerRef);
	};
	Shooter.prototype.shoot = function (elu) {
		var angleToTarget = getAngleTo(this, this.target);
		
		elu.enemyBullets[elu.enemyBulletInd].activate(this.x, this.y, angleToTarget + Math.PI / 2);
		elu.enemyBulletInd = (elu.enemyBulletInd + 1) % elu.enemyBullets.length;
		this.lastShotTime = performance.now();
	};
	Shooter.prototype.activate = function (elu) {
		var miningShooters = 0;
		var shooterInd;
		
		for (shooterInd = 0; shooterInd < elu.shooters.length; shooterInd++) {
			if (elu.shooters[shooterInd].target instanceof Asteroid) {
				miningShooters++;
			}
		}
		if (miningShooters > 1) {
			this.target = elu.playerRef;
		} else {
			this.target = getRandomIndex(elu.asteroids);
		}
		placeAwayFrom(elu.playerRef.x, elu.playerRef.y, this);
		this.foundPlayer = false;
		this.shooting = false;
		this.active = true;
	};
	Shooter.prototype.kill = function (elu) {
		this.target = null;
		this.active = false;
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
			if (elu.asteroids[entInd].active && circleCollidingWith(this, elu.asteroids[entInd])) {
				elu.crystals[elu.crystalInd].activate(elu.asteroids[entInd].x, elu.asteroids[entInd].y, Math.random() * 2 * Math.PI, elu);
				elu.asteroids[entInd].kill(elu.playerRef);
				elu.crystalInd = (elu.crystalInd + 1) % elu.crystals.length;
				this.active = false;
				return;
			}
		}
		if (circleCollidingWith(this, elu.playerRef) && elu.playerRef.active && elu.bossRef.active) {
			this.active = false;
			elu.playerRef.kill(elu);
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
			if (elu.asteroids[entInd].active && circleCollidingWith(this, elu.asteroids[entInd])) {
			    elu.asteroids[entInd].heatUp(1, elu);
				this.active = false;
				return;
			}
		}
		for (entInd = 0; entInd < elu.miners.length; entInd++) {
			if (elu.miners[entInd].active && circleCollidingWith(this, elu.miners[entInd])) {
			    elu.miners[entInd].kill(elu);
			    score += 1;
				this.active = false;
				return;
			}
		}
		for (entInd = 0; entInd < elu.shooters.length; entInd++) {
			if (elu.shooters[entInd].active && circleCollidingWith(this, elu.shooters[entInd])) {
			    elu.shooters[entInd].kill(elu);
			    score += 5;
				this.active = false;
				return;
			}
		}
	};
	PlayerBullet.prototype.draw = function () {
		drawCircle(this.x - screenX, this.y - screenY, this.collRadius, "#CCCCCC");
	};
	function Bomb() {
		this.collLines = new Array(6);
	};
	Bomb.prototype = Object.create(Entity.prototype);
	Bomb.prototype.collRadius = 5;
	Bomb.prototype.blipColor = null;
	Bomb.prototype.lifeSpan = 4000;
	Bomb.prototype.maxVel = .3;
	Bomb.prototype.birthTime = 0;
	Bomb.prototype.accel = .0010;
	Bomb.prototype.target = null;
	Bomb.prototype.angleToTarget = 0;
	Bomb.prototype.turnSpeed = .010;
	Bomb.prototype.updateCollLines = function () {
		updateTriangle(this.collLines, this.angle, this.collRadius);
	};
	Bomb.prototype.activate = function (elu, x, y) {
		this.birthTime = performance.now();
		this.target = elu.bossRef;
		// immediately point at the target
		this.angle = getAngleTo(this, this.target);
		this.x = x;
		this.y = y;
		this.throttle = true;
		this.active = true;
	};
	Bomb.prototype.updateState = function (delta, elu) {
		var other;
		var pieceInd;
		var nextInd;
		
		if (performance.now() - this.birthTime > this.lifeSpan) {
			this.active = false;
			return;
		}
		this.updateCollLines();
		if (!this.target.active) {
			this.target = getNearestActive(this, elu.bossPieces);
		}
		this.turnToTarget(delta);
		this.xVelDelta = this.accel * Math.cos(this.angle + Math.PI / 2);
		this.yVelDelta = this.accel * Math.sin(-(this.angle + Math.PI / 2));
		this.xVel += this.xVelDelta * delta;
		this.yVel += this.yVelDelta * delta;
		if (this.xVel > this.maxVel) {
			this.xVel = this.maxVel;
		} else if (this.xVel < -this.maxVel) {
			this.xVel = -this.maxVel;
		}
		if (this.yVel > this.maxVel) {
			this.yVel = this.maxVel;
		} else if (this.yVel < -this.maxVel) {
			this.yVel = -this.maxVel;
		}
		this.x += this.xVel * delta;
		this.y += this.yVel * delta;
		other = checkCollision(this, elu);
		if (other &&
			other instanceof Asteroid || 
			other instanceof Miner || 
			other instanceof Shooter) {
				other.kill(elu);
				this.active = false;
		}
		for (pieceInd = elu.bossPieces.length - 1; pieceInd >= 0; pieceInd--) {
			if (elu.bossPieces[pieceInd].active &&
				collidingWith(this, elu.bossPieces[pieceInd])) {
					if (elu.bossRef.alive) {
					    if (pieceInd < elu.bossPieces.length - 1 ||
                            (pieceInd == elu.bossPieces.length - 1 && elu.bossRef.activePieces == 1)) {
							elu.bossPieces[pieceInd].kill(elu);
						} else {
							for (nextInd = elu.bossPieces.length - 2; nextInd >= 0; nextInd--) {
								if (elu.bossPieces[nextInd].active) {
								    elu.bossPieces[nextInd].kill(elu);
								    score += 100;
									break;
								}
							}
						}
						elu.playerRef.collisionOn = true;
					}
					this.active = false;
					break;
				}
		}
	};
	Bomb.prototype.draw = function () {
		drawPolygon(this.x, this.y, this.collLines, "#55FFFF");
	};
    function Crystal() { };
    Crystal.prototype = Object.create(Entity.prototype);
	Crystal.prototype.collRadius = 3;
	Crystal.prototype.blipColor = "#BBBBFF";
	Crystal.prototype.maxVel = .07;
	Crystal.prototype.birthTime = 0;
	Crystal.prototype.lifeSpan = 10000;
	Crystal.prototype.activate = function (x, y, dir, elu) {
	    this.birthTime = performance.now();
	    this.x = x;
	    this.y = y;
	    this.xVel = Math.cos(dir) * this.maxVel;
	    this.yVel = Math.sin(-dir) * this.maxVel;
	    assignMinerToCrystal(elu, this);
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
				return;
			}
		}
		other = circleCollidingWith(this, elu.playerRef);
		if (other) {
			other.addBomb();
			this.active = false;
		}
	};
	Crystal.prototype.draw = function () {
		drawCircle(this.x - screenX, this.y - screenY, this.collRadius, "#5555FF");
	};
	function Boss() {
		placeAwayFrom(0, 0, this);
		this.lastShooterSpawn = performance.now();
		this.active = true;
	};
	Boss.prototype = Object.create(Entity.prototype);
	Boss.prototype.blipColor = "#FFFF00";
	Boss.prototype.defaultAccel = .0007;
	Boss.prototype.defaultMaxVel = .35;
	Boss.prototype.accel = Boss.prototype.defaultAccel;
	Boss.prototype.angleDelta = 0;
	Boss.prototype.maxVel = Boss.prototype.defaultMaxVel;
	Boss.prototype.collRadius = BOSS_RADIUS;
	Boss.prototype.target = null;
	Boss.prototype.angleToTarget = 0;
	Boss.prototype.turnSpeed = .07;
	Boss.prototype.activePieces = 0;
	Boss.prototype.alive = false;
	Boss.prototype.caught = false;
	Boss.prototype.lastCaught = 0;
	Boss.prototype.catchTime = 5000;
	Boss.prototype.maxChasing = 0;
	Boss.prototype.lastShooterSpawn = 0;
	Boss.prototype.shooterSpawnInterval = 7000;
	Boss.prototype.chaseStartDelay = 7000;
	Boss.prototype.nearDistance = 200;
	Boss.prototype.catchDistance = 100;
	Boss.prototype.isHurt = false;
	Boss.prototype.lastHurt = 0;
	Boss.prototype.hurtTimeout = 800;
	Boss.prototype.timeOfDeath = 0;
	Boss.prototype.maxShooters = 5;
	Boss.prototype.maxMiners = 5;
	Boss.prototype.maxAsteroids = 20;
	Boss.prototype.updateState = function (delta, elu) {
		var minerInd;
		var miner;
		var angleToMe;
		var velCoeff;
		var shooterInd;
		
		this.x = elu.bossRef.x;
		this.y = elu.bossRef.y;
		if (!this.alive) {
			for (minerInd = 0; minerInd < elu.miners.length; minerInd++) {
				miner = elu.miners[minerInd];
				if (distance(this.x, this.y, miner.x, miner.y) < 25 && miner.hasCrystal) {
					this.activePieces++;
					if (this.activePieces == elu.bossPieces.length) {
					    this.alive = true;
					    statusColor = "#FF0000";
					}
					elu.bossPieces[this.activePieces - 1].active = true;
					miner.hasCrystal = false;
					miner.kill(elu);
					if (this.alive) {
						this.target = elu.playerRef;
						this.throttle = true;
					}
				}
			}
		} else {
			if (this.isHurt) {
				this.accel = this.defaultAccel;
				this.maxVel = this.defaultMaxVel / 2;
				this.moveSelf(delta, elu);
				if (performance.now() - this.lastHurt > this.hurtTimeout) {
					this.isHurt = false;
				}
			} else if (!this.caught) {
			    // chase the player
				this.turnToTarget(delta);
				if (distance(this.x, this.y, this.target.x, this.target.y) < this.nearDistance) {
					// turn on a dime
					this.accel = .01;
					this.maxVel = this.defaultMaxVel * .75;
				} else {
					this.accel = this.defaultAccel;
					this.maxVel = this.defaultMaxVel;
				}
				if (performance.now() - elu.playerRef.lastDeath > this.chaseStartDelay) {
				    this.moveSelf(delta, elu);
				}
				if (this.target.active && 
					distance(this.x, this.y, this.target.x, this.target.y) < this.catchDistance) {
					this.caught = true;
					this.lastCaught = performance.now();
				}
			} else if (this.target.active) {
				// play the player death animation
				this.target.collisionOn = false;
				if (performance.now() - this.lastCaught > this.catchTime &&
					distance(this.x, this.y, this.target.x, this.target.y) < 30) {
						this.target.kill(elu);
						this.target.collisionOn = true;
						return;
				}
				angleToMe = getAngleTo(this.target, this);
				this.target.angle += .03 * delta;
				this.target.updateCollLines();
				this.target.xVelDelta = .006 * Math.cos(angleToMe + Math.PI / 2);
                this.target.yVelDelta = .006 * Math.sin(-(angleToMe + Math.PI / 2));
				this.target.xVel += this.target.xVelDelta;
				this.target.yVel += this.target.yVelDelta;
				velCoeff = (this.catchTime - (performance.now() - this.lastCaught)) / this.catchTime;
				if (this.target.xVel > velCoeff * this.target.maxVel) {
					this.target.xVel = velCoeff * this.target.maxVel;
				}
				if (this.target.xVel < velCoeff * -this.target.maxVel) {
					this.target.xVel = velCoeff * -this.target.maxVel;
				}
				if (this.target.yVel > velCoeff * this.target.maxVel) {
					this.target.yVel = velCoeff * this.target.maxVel;
				}
				if (this.target.yVel < velCoeff * -this.target.maxVel) {
					this.target.yVel = velCoeff * -this.target.maxVel;
				}
				this.target.x += this.target.xVel * delta;
				this.target.y += this.target.yVel * delta;
			}
		}
		fieldWrap(this, elu.playerRef);
		// spawn shooters
		if (performance.now() - this.lastShooterSpawn > this.shooterSpawnInterval) {
			for (shooterInd = 0; shooterInd < this.maxShooters; shooterInd++) {
				if (!elu.shooters[shooterInd].active) {
					elu.shooters[shooterInd].activate(elu);
					this.lastShooterSpawn = performance.now();
					break;
				}
			}
		}
		// resurrect the player
		if (!elu.playerRef.active) {
		    if (performance.now() - elu.playerRef.lastDeath >= elu.playerRef.respawnDelay) {
				elu.playerRef.activate(elu);
				if (this.caught) {
					this.caught = false;
				}
			}
		}
	};
	Boss.prototype.hurt = function () {
		this.caught = false; // let go of the player
		if (this.activePieces == 0) {
			this.timeOfDeath = performance.now();
			this.alive = false;
			this.active = false;
			this.caught = false;
			score += 1000;
			statusColor = "#00FFFF";
		} else {
			this.lastHurt = performance.now();
			this.isHurt = true;
		}
	};
	Boss.prototype.activate = function (elu) {
	    // new level setup
	    const WORKER_ZONE = 1;
	    const WARRIOR_ZONE = 2;
	    const PLANETOID_ZONE = 3;
	    const VOID_ZONE = 0;
	    var entInd;
		
		for (entInd = 0; entInd < elu.miners.length; entInd++) {
			elu.miners[entInd].hasCrystal = false;
		}
		if (elu.playerRef.level > 0) {
			switch (elu.playerRef.level % 4) {
				case WORKER_ZONE:
					this.maxMiners = elu.miners.length;
					this.maxShooters = 3;
					this.maxAsteroids = 20;
					updateStatus("Arrived at Worker Zone");
					break;
				case WARRIOR_ZONE:
					this.maxMiners = 5;
					this.maxShooters = elu.shooters.length;
					this.maxAsteroids = 20;
					updateStatus("Arrived at Warrior Zone");
					break;
			    case PLANETOID_ZONE:
			        this.maxMiners = 5;
			        this.maxShooters = 3;
			        this.maxAsteroids = elu.asteroids.length;
			        updateStatus("Arrived at Planetoid Zone");
			        break;
				case VOID_ZONE:
					this.maxMiners = 5;
					this.maxShooters = 5;
					this.maxAsteroids = 7;
					updateStatus("Arrived at Void Zone");
					break;
				default:
					break;
			}
		}
		for (entInd = 0; entInd < elu.miners.length; entInd++) {
			if (entInd < this.maxMiners) {
				elu.miners[entInd].activate(
				elu.playerRef.x + (Math.random() >= .5 ? 1 : -1) * Math.random() * (MAX_DISTANCE - 300) + 200,
				elu.playerRef.y + (Math.random() >= .5 ? 1 : -1) * Math.random() * (MAX_DISTANCE - 300) + 200,
				elu);
			} else {
				elu.miners[entInd].active = false;
			}
		}
		for (entInd = 0; entInd < elu.shooters.length; entInd++) {
				elu.shooters[entInd].active = false;
		}
		for (entInd = 0; entInd < elu.asteroids.length; entInd++) {
			if (entInd < this.maxAsteroids) {
				elu.asteroids[entInd].active = true;
			} else {
				elu.asteroids[entInd].active = false;
			}
		}
		Boss.call(this);
	}
	Boss.prototype.draw = function () {			
	};
	function BossPiece(pieceNumber) {
		switch (pieceNumber) {
			case 0:
				this.collLines = [Math.cos(Math.PI / 4) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI / 4) * Boss.prototype.collRadius / 2,
					Boss.prototype.collRadius / 2,
					0,
					Boss.prototype.collRadius,
					0,
					Math.cos(Math.PI / 4) * Boss.prototype.collRadius,
					Math.sin(-Math.PI / 4) * Boss.prototype.collRadius];
				break;
			case 1:
				this.collLines = [Math.cos(Math.PI / 2) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI / 2) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI / 4) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI / 4) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI / 4) * Boss.prototype.collRadius,
					Math.sin(-Math.PI / 4) * Boss.prototype.collRadius,
					Math.cos(Math.PI / 2) * Boss.prototype.collRadius,
					Math.sin(-Math.PI / 2) * Boss.prototype.collRadius];
				break;
			case 2:
				this.collLines = [Math.cos(Math.PI * (3 / 4)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (3 / 4)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI / 2) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI / 2) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI / 2) * Boss.prototype.collRadius,
					Math.sin(-Math.PI / 2) * Boss.prototype.collRadius,
					Math.cos(Math.PI * (3 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (3 / 4)) * Boss.prototype.collRadius];
				break;
			case 3:
				this.collLines = [Math.cos(Math.PI) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (3 / 4)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (3 / 4)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (3 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (3 / 4)) * Boss.prototype.collRadius,
					Math.cos(Math.PI) * Boss.prototype.collRadius,
					Math.sin(-Math.PI) * Boss.prototype.collRadius];
				break;
			case 4:
				this.collLines = [Math.cos(Math.PI * (5 / 4)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (5 / 4)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI) * Boss.prototype.collRadius,
					Math.sin(-Math.PI) * Boss.prototype.collRadius,
					Math.cos(Math.PI * (5 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (5 / 4)) * Boss.prototype.collRadius];
				break;
			case 5:
				this.collLines = [Math.cos(Math.PI * (3 / 2)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (3 / 2)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (5 / 4)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (5 / 4)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (5 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (5 / 4)) * Boss.prototype.collRadius,
					Math.cos(Math.PI * (3 / 2)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (3 / 2)) * Boss.prototype.collRadius];
				break;
			case 6:
				this.collLines = [Math.cos(Math.PI * (7 / 4)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (7 / 4)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (3 / 2)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (3 / 2)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (3 / 2)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (3 / 2)) * Boss.prototype.collRadius,
					Math.cos(Math.PI * (7 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (7 / 4)) * Boss.prototype.collRadius];
				break;
			case 7:
				this.collLines = [Boss.prototype.collRadius / 2,
					0,
					Math.cos(Math.PI * (7 / 4)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (7 / 4)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (7 / 4)) * Boss.prototype.collRadius,
					Math.sin(-Math.PI * (7 / 4)) * Boss.prototype.collRadius,
					Boss.prototype.collRadius,
					0];
				break;
			case 8:
				this.collLines = [Boss.prototype.collRadius / 2,
					0,
					Math.cos(Math.PI / 4) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI / 4) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (1 / 2)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (1 / 2)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (3 / 4)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (3 / 4)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (5 / 4)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (5 / 4)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (3 / 2)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (3 / 2)) * Boss.prototype.collRadius / 2,
					Math.cos(Math.PI * (7 / 4)) * Boss.prototype.collRadius / 2,
					Math.sin(-Math.PI * (7 / 4)) * Boss.prototype.collRadius / 2];
				break;
			default:
				break;
		}
	};
	BossPiece.prototype = Object.create(Entity.prototype);
	BossPiece.prototype.blipColor = null;
	BossPiece.prototype.accel = 0;
	BossPiece.prototype.maxVel = 0;
	BossPiece.prototype.collRadius = BOSS_RADIUS;
	BossPiece.prototype.updateState = function (delta, elu) {
		this.x = elu.bossRef.x;
		this.y = elu.bossRef.y;
	};
	BossPiece.prototype.kill = function (elu) {
		elu.bossRef.activePieces--;
		elu.bossRef.hurt();
		this.active = false;
	};
	BossPiece.prototype.draw = function () {
        drawPolygon(this.x, this.y, this.collLines, "#444444");
	};
	startGame();
}());