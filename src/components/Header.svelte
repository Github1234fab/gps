<script>
    import Date from "../components/Date.svelte";
</script>
<main>
<Date/>
<!-- <a href="../components/Header.svelte"><img src="/partage.png" alt="icône de partage"></a> -->
<img src="/menu.png" alt="">
</main>

<style>
    main{
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: linear-gradient(to top, blue, rgb(172, 189, 240));
        padding: 10px;
        height: auto;
        
    }
    img{
        width: 50px;
        height: 50px;
    }
</style>