let arr = [
{
	id: 0,
	name: "victor"
},
{
	id: 1,
	name: "lucille"
},
{
	id: 2,
	name: "sandrine"
}]

let test = arr.find(function (value, index, arr) {
	return (value.id === 1);
});

console.log(arr);
test.name = "de la merde"
console.log(arr);

