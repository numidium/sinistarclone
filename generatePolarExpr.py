import math

def generatePolarExpr(x, y, i):
	r = math.sqrt(pow(x, 2) + pow(y, 2))
	theta = math.atan2(x, y)
	print("this.collLines["+ str(i) + "] = Math.cos(" + str(theta) + " + this.angle) * " + str(r) + ";")
	print("this.collLines["+ str(i + 1) + "] = Math.sin(" + str(-theta) + " - this.angle) * " + str(r) + ";")

vectors = [15, -1,
           13, -3,
           2, -3,
           -10, -15,
           -14, -15,
           -15, -14,
           -15, -12,
           -8, -4,
           -8, 4,
           -15, 12,
           -15, 14,
           -14, 15,
           -10, 15,
           2, 3,
           13, 3,
           15, 1]
i = 0
while i < len(vectors):
	generatePolarExpr(vectors[i], vectors[i+1], i)
	i += 2
